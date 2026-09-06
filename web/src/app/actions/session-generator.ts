"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface SessionParams {
  ageGroup: string;
  sessionType: string;
  focusArea: string;
  durationMinutes: number;
  squadSize: number;
  sessionId?: string;
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
): Promise<{ plan?: string; error?: string }> {
  try {
    await requireUser();

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

Generate exactly 5 drills in this exact format (plain text, no markdown, no asterisks):

DRILL 1: [Drill Name] ([X] min)
LTPD Focus: [specific competency this builds at this age phase]
4-Corner: [Technical / Tactical / Physical / Social — pick primary]
Setup: [pitch dimensions, cones, groups, equipment needed]
Instructions: [clear numbered steps — how to run the drill]
Coaching Points: [2 precise, age-appropriate cues coaches should give]

DRILL 2: [Drill Name] ([X] min)
LTPD Focus: [specific competency this builds at this age phase]
4-Corner: [Technical / Tactical / Physical / Social — pick primary]
Setup: [pitch dimensions, cones, groups, equipment needed]
Instructions: [clear numbered steps — how to run the drill]
Coaching Points: [2 precise, age-appropriate cues coaches should give]

DRILL 3: [Drill Name] ([X] min)
LTPD Focus: [specific competency this builds at this age phase]
4-Corner: [Technical / Tactical / Physical / Social — pick primary]
Setup: [pitch dimensions, cones, groups, equipment needed]
Instructions: [clear numbered steps — how to run the drill]
Coaching Points: [2 precise, age-appropriate cues coaches should give]

DRILL 4: [Drill Name] ([X] min)
LTPD Focus: [specific competency this builds at this age phase]
4-Corner: [Technical / Tactical / Physical / Social — pick primary]
Setup: [pitch dimensions, cones, groups, equipment needed]
Instructions: [clear numbered steps — how to run the drill]
Coaching Points: [2 precise, age-appropriate cues coaches should give]

DRILL 5: [Drill Name] ([X] min) — Small-Sided Game
LTPD Focus: [specific competency this builds at this age phase]
4-Corner: [Technical / Tactical / Physical / Social — pick primary]
Setup: [pitch dimensions, cones, groups, equipment needed — max 7v7]
Instructions: [clear numbered steps — how to run the drill]
Coaching Points: [2 precise, age-appropriate cues coaches should give]

COACH REFLECTION: [One question the coach should ask the squad after the session to reinforce the learning]`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1000,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your training sessions are grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), SAFA's National Development Programme curriculum, and CAF youth development principles. You understand the South African grassroots football landscape and design sessions that are practical, player-centred, and aligned to international best practice. Plain text only — no asterisks, no Markdown formatting.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { plan: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}
