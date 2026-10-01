"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import { getLTPDPhase, specialistSystem } from "@/lib/ai-safeguards";
import { renderSessionPlanProse } from "@/lib/session-plan";
import { constraintLines, normaliseConstraints, type KitValue, type SpaceValue } from "@/lib/session-constraints";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface SessionParams {
  ageGroup: string;
  sessionType: string;
  focusArea: string;
  durationMinutes: number;
  squadSize: number;
  sessionId?: string;
  /** Real-world limits (docs/BACKLOG.md 5.6). Validated against the lists in
   * lib/session-constraints.ts; anything else is ignored. */
  space?: SpaceValue;
  kit?: KitValue[];
}

export interface SessionDrill {
  name: string;
  durationMinutes: number;
  ltpdFocus: string;
  fourCorner: string;
  setup: string;
  instructions: string;
  coachingPoints: string;
}
export interface SessionPlanStructured {
  drills: SessionDrill[];
  coachReflection: string;
}

export async function generateSessionPlan(
  params: SessionParams
): Promise<{ plan?: string; structured?: SessionPlanStructured; error?: string }> {
  try {
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };


    const { ageGroup, sessionType, focusArea } = params;
    const constraints = normaliseConstraints(params);
    const { durationMinutes } = constraints;
    const ltpdPhase = getLTPDPhase(ageGroup);

    const prompt = `Generate a complete, structured training session plan for a SAFA-registered youth football academy.

SESSION PARAMETERS:
- Age Group: ${ageGroup} | LTPD Phase: ${ltpdPhase}
- Session Type: ${sessionType}
- Focus Area: ${focusArea}

CONSTRAINTS (the session must fit these, they are not suggestions):
${constraintLines(constraints).join("\n")}

DESIGN REQUIREMENTS:
- Follow FIFA's 5-phase session structure: Activation -> Technical -> Tactical -> Small-Sided Game -> Recovery/Reflection
- Apply the 4-Corner Player Development Model across drills: Technical, Tactical, Physical, Social/Psychological
- Phase-specific guidance:
  U6-U9 (FUNdamentals): ABC movement skills, maximum fun, no set plays, every player touches the ball constantly
  U10-U12 (Learning to Train): high repetition ball mastery, 1v1 challenges, simple combination patterns
  U13-U15 (Training to Train): introduce positional awareness, combination play, defensive shape, directional pressure
  U16-U18 (Training to Compete): high-intensity transitions, game model concepts, pressing triggers, set pieces
- Coaching cues must be specific, actionable, and age-appropriate
- Align drills with SAFA NDP competency standards for the age group
- Reflect South African grassroots context (limited equipment, mixed ability squads are common)

Generate exactly 5 drills, the 5th a small-sided game of max 7v7. For each: a name, its duration in minutes (summing to roughly ${durationMinutes} minutes across all 5), the specific LTPD competency it builds at this age phase, its primary 4-Corner focus (Technical / Tactical / Physical / Social), the setup (pitch dimensions, cones, groups, equipment needed), clear numbered-step instructions for how to run it, and 2 precise age-appropriate coaching points. Finish with one question the coach should ask the squad after the session to reinforce the learning.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1800,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: specialistSystem({ focus: "training sessions" }),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            drills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER },
                  ltpdFocus: { type: Type.STRING },
                  fourCorner: { type: Type.STRING },
                  setup: { type: Type.STRING },
                  instructions: { type: Type.STRING },
                  coachingPoints: { type: Type.STRING },
                },
                required: ["name", "durationMinutes", "ltpdFocus", "fourCorner", "setup", "instructions", "coachingPoints"],
              },
            },
            coachReflection: { type: Type.STRING },
          },
          required: ["drills", "coachReflection"],
        },
      },
    });

    const parsed = parseJsonObject(response.text ?? "");
    if (!parsed) return { error: "Could not read the AI's session plan. Try again." };
    const structured = parsed as unknown as SessionPlanStructured;
    const plan = renderSessionPlanProse(structured).replace(/\*/g, "");

    return { plan, structured };
  } catch (err) {
    return { error: aiError(err) };
  }
}
