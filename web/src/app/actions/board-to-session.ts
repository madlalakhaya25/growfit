"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import { getLTPDPhase, specialistSystem } from "@/lib/ai-safeguards";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { SESSION_PLAN_SCHEMA } from "@/lib/session-plan-schema";
import { PROGRESSION_STAGES, renderSessionPlanProse, validateProgression } from "@/lib/session-plan";
import type { SessionPlanStructured } from "./session-generator";
import { generateWithRetry } from "@/lib/ai-resilient";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MAX_SUMMARY_CHARS = 3000;

/**
 * Draw a play, get a three-drill progression that teaches it: unopposed, then
 * opposed, then a small-sided game. Returns the same `SessionPlanStructured`
 * as the session generator, so the existing Apply path (`addDrills` +
 * `packDrillDescription`) and the "DRILL N:" prose display work unchanged.
 *
 * Nothing is saved here; the coach reads it and chooses a session to add it to.
 * The age group comes from the team row, not the client, and only a team the
 * caller coaches is accepted -- RLS is academy-wide, so that check is ours.
 */
export async function generateSessionFromBoard(params: {
  teamId: string;
  playName: string;
  conceptLabels: string[];
  /** The board as text, from the panel's summariseBoard(). */
  summary: string;
  durationMinutes?: number;
}): Promise<{ plan?: string; structured?: SessionPlanStructured; error?: string }> {
  try {
    const { supabase, user } = await requireUser();

    const { data: team } = await supabase
      .from("teams")
      .select("id, age_group")
      .eq("id", params.teamId)
      .in("id", await getCoachedTeamIds(supabase, user.id))
      .eq("active", true)
      .single();
    if (!team) return { error: "You don't coach this team." };

    const summary = params.summary.trim().slice(0, MAX_SUMMARY_CHARS);
    if (!summary) return { error: "Put some players on the board first." };

    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const ageGroup = ((team.age_group as string | null) ?? "").trim() || "U15";
    const minutes = Math.min(Math.max(Math.round(params.durationMinutes ?? 45), 20), 90);
    const concepts = params.conceptLabels.length ? params.conceptLabels.slice(0, 6).join(", ") : "not tagged";

    const prompt = `A youth football coach has drawn a play on a tactical board and wants a short training progression that teaches it.

PLAY NAME: ${params.playName.trim().slice(0, 80) || "Untitled play"}
AGE GROUP: ${ageGroup} | LTPD Phase: ${getLTPDPhase(ageGroup)}
TAGGED CONCEPTS: ${concepts}
TOTAL TIME: about ${minutes} minutes

BOARD DESCRIPTION (generated from what the coach drew):
${summary}

Write exactly 3 drills, in this order, each building on the one before:
1. ${PROGRESSION_STAGES[0]}: the movement pattern of the play with no defenders, so players learn where to be and when.
2. ${PROGRESSION_STAGES[1]}: the same pattern against defenders with limited pressure, so players learn when it is on and when it is not.
3. ${PROGRESSION_STAGES[2]}: a game of no more than 7v7 with a rule that makes the pattern the best option, so players find it themselves.

Work only from the board description; do not invent players or movements that are not listed. Name each drill so the stage is clear. For each drill give its duration in minutes (summing to roughly ${minutes}), the LTPD competency it builds at this age phase, its primary 4-Corner focus (Technical / Tactical / Physical / Social), the setup (pitch size, cones, groups, equipment; South African grassroots, so assume little kit), clear numbered-step instructions, and 2 precise age-appropriate coaching points. Finish with one question the coach should ask the squad afterwards.`;

    const response = await generateWithRetry(ai, {
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1600,
        // Direct-answer task: thinking tokens would eat the visible-output
        // budget and truncate the JSON with no error.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: specialistSystem({ focus: "training sessions", plainText: "in every field" }),
        responseMimeType: "application/json",
        responseSchema: SESSION_PLAN_SCHEMA,
      },
    });

    const structured = validateProgression(parseJsonObject(response.text ?? ""));
    if (!structured) return { error: "Could not read the AI's progression. Try again." };
    return { plan: renderSessionPlanProse(structured), structured };
  } catch (err) {
    return { error: aiError(err) };
  }
}
