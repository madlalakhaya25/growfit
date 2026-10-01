"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { generateOrServeText, type CachedTextResult } from "@/lib/ai-cached";
import { COACH_SYSTEM } from "@/lib/ai-safeguards";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { loadOpponentMemory } from "@/lib/opponent-memory-data";
import { buildScoutingBrief, hasNoScoutingHistory } from "@/lib/scouting-brief";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const NO_SCOUTING_HISTORY =
  "We have nothing logged against this opponent yet: no past result and no saved play. " +
  "Log the result after the match, or draw their shape on the tactical board, and the report will have something to work from.";

/**
 * An opponent report built ONLY from what the academy has itself logged
 * against them. With nothing logged it says so, and makes no model call --
 * a report written from nothing would have to be invented.
 *
 * Cached per fixture for 24h as a `scouting_report` artefact (migration 048;
 * until it runs the report is returned with `persisted: false`).
 */
export async function generateScoutingReport(params: {
  teamId: string;
  fixtureId: string;
  force?: boolean;
}): Promise<CachedTextResult & { noHistory?: boolean }> {
  try {
    const { supabase, user } = await requireUser();

    // Not redundant with RLS, which is academy-wide: a coach may only scout for
    // a team they coach, and only for that team's own fixture.
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, academy_id")
      .eq("id", params.teamId)
      .in("id", await getCoachedTeamIds(supabase, user.id))
      .eq("active", true)
      .single();
    if (!team) return { error: "You don't coach this team." };

    const { data: fixture } = await supabase
      .from("fixtures")
      .select("id, opponent")
      .eq("id", params.fixtureId)
      .eq("team_id", params.teamId)
      .single();
    if (!fixture) return { error: "Fixture not found." };

    const memory = await loadOpponentMemory(supabase, {
      teamId: params.teamId,
      opponent: fixture.opponent as string,
      fixtureId: params.fixtureId,
    });
    if (hasNoScoutingHistory(memory.meetings, memory.formations)) {
      return { text: NO_SCOUTING_HISTORY, cached: false, persisted: false, noHistory: true };
    }

    const brief = buildScoutingBrief({
      teamName: team.name as string,
      opponent: (fixture.opponent as string).trim(),
      meetings: memory.meetings,
      formations: memory.formations,
    });

    return await generateOrServeText(supabase, {
      kind: "scouting_report",
      subjectType: "fixture",
      subjectId: params.fixtureId,
      academyId: team.academy_id as string,
      userId: user.id,
      brief,
      modelId: AI_MODEL,
      force: params.force,
      beforeGenerate: () => checkAiBudget(user.id),
      generate: async () => {
        const response = await ai.models.generateContent({
          model: AI_MODEL,
          contents:
            `Write a short scouting report on this opponent for our next fixture.\n\n${brief}\n\n` +
            "Use only the facts above. If something is not there, say it is not logged — never invent a formation, a player or a result. " +
            "Give three short sections with exactly these headings: WHAT WE KNOW, WHAT TO CHECK IN THE WARM-UP, HOW THIS SHOULD SHAPE OUR PLAN. " +
            "Two or three sentences each, in plain text.",
          config: {
            maxOutputTokens: 700,
            thinkingConfig: { thinkingBudget: 0 },
            systemInstruction: COACH_SYSTEM,
          },
        });
        return { text: (response.text ?? "").replace(/\*/g, "").trim(), response };
      },
    });
  } catch (err) {
    return { error: aiError(err) };
  }
}
