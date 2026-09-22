"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";
import { aiError, checkAiBudget } from "@/lib/ai-guard";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface SessionParams {
  ageGroup: string;
  sessionType: string;
  focusArea: string;
  durationMinutes: number;
  squadSize: number;
  sessionId?: string;
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

/** Same JSON-mode parsing fallback as coach-assistant.ts / player-import.ts. */
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/**
 * Renders the exact "DRILL N: Name (X min)" prose shape the old freeform
 * prompt produced, from the now-structured data — session-generator-panel.tsx
 * still splits on `/(?=DRILL \d+:)/g` to render each drill, so this keeps
 * that display completely unchanged.
 */
function renderSessionPlanProse(s: SessionPlanStructured): string {
  const lines: string[] = [];
  s.drills.forEach((d, i) => {
    if (i > 0) lines.push("");
    lines.push(`DRILL ${i + 1}: ${d.name} (${d.durationMinutes} min)`);
    lines.push(`LTPD Focus: ${d.ltpdFocus}`);
    lines.push(`4-Corner: ${d.fourCorner}`);
    lines.push(`Setup: ${d.setup}`);
    lines.push(`Instructions: ${d.instructions}`);
    lines.push(`Coaching Points: ${d.coachingPoints}`);
  });
  lines.push("");
  lines.push(`COACH REFLECTION: ${s.coachReflection}`);
  return lines.join("\n");
}

function getLTDPPhase(ageGroup: string): string {
  const match = ageGroup.match(/\d+/);
  if (!match) return "Training to Train (U13-U15)";
  const age = parseInt(match[0], 10);
  if (age <= 9)  return "FUNdamentals (U6-U9) — ABCs of movement, fun-first, no tactical demands";
  if (age <= 12) return "Learning to Train (U10-U12) — first technical window, high ball contacts, 1v1 mastery";
  if (age <= 15) return "Training to Train (U13-U15) — positional play, decision-making, tactical introduction";
  if (age <= 18) return "Training to Compete (U16-U18) — game model implementation, high-intensity transitions, set pieces";
  return "Training to Win (U19+) — elite competition preparation, full tactical complexity";
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


    const { ageGroup, sessionType, focusArea, durationMinutes, squadSize } = params;
    const ltpdPhase = getLTDPPhase(ageGroup);

    const prompt = `Generate a complete, structured training session plan for a SAFA-registered youth football academy.

SESSION PARAMETERS:
- Age Group: ${ageGroup} | LTPD Phase: ${ltpdPhase}
- Session Type: ${sessionType}
- Focus Area: ${focusArea}
- Total Duration: ${durationMinutes} minutes
- Squad Size: ${squadSize} players

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
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your training sessions are grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), SAFA's National Development Programme curriculum, and CAF youth development principles. You understand the South African grassroots football landscape and design sessions that are practical, player-centred, and aligned to international best practice. Plain text only — no asterisks, no Markdown formatting.",
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
