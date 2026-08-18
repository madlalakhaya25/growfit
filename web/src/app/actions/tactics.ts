"use server";

import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";
import { getConcept } from "@/lib/tactics";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Mirrors the LTPD phase mapping used by the session generator so tactical
// explanations are pitched at the right developmental stage for the age group.
function getLTPDPhase(ageGroup: string): string {
  const match = ageGroup.match(/\d+/);
  if (!match) return "Training to Train (U13-U15)";
  const age = parseInt(match[0], 10);
  if (age <= 9) return "FUNdamentals (U6-U9) — ABCs of movement, fun-first, no tactical demands";
  if (age <= 12) return "Learning to Train (U10-U12) — first technical window, high ball contacts, 1v1 mastery";
  if (age <= 15) return "Training to Train (U13-U15) — positional play, decision-making, tactical introduction";
  if (age <= 18) return "Training to Compete (U16-U18) — game model implementation, high-intensity transitions, set pieces";
  return "Training to Win (U19+) — elite competition preparation, full tactical complexity";
}

export async function explainPositionalRole(params: {
  positionLabel: string;
  ageGroup: string;
}): Promise<{ explanation?: string; error?: string }> {
  try {
    await requireUser();

    const positionLabel = params.positionLabel.trim();
    if (!positionLabel) return { error: "Pick a position first." };

    const ageGroup = params.ageGroup.trim() || "U15";
    const ltpdPhase = getLTPDPhase(ageGroup);

    const prompt = `Explain the role of the ${positionLabel} position for a coach at a SAFA-registered grassroots youth academy.

POSITION: ${positionLabel}
AGE GROUP: ${ageGroup} | LTPD Phase: ${ltpdPhase}

Describe what this position is actually responsible for, pitched at the LTPD phase above — what is age-appropriate to expect at ${ageGroup}, and what should NOT be demanded yet. Reflect South African grassroots reality (mixed-ability squads, small-sided formats at younger ages).

Return plain text (no markdown, no asterisks) in exactly this structure:

ROLE IN A SENTENCE: [one clear sentence a player would understand]
IN POSSESSION: [3 numbered responsibilities when the team has the ball]
OUT OF POSSESSION: [3 numbered responsibilities when the team loses the ball]
KEY ATTRIBUTES TO DEVELOP: [3 qualities to work on at this age]
COMMON MISTAKES AT ${ageGroup}: [2 typical errors and the fix]
COACHING CUES: [3 short phrases the coach can shout to this player during play]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        maxOutputTokens: 900,
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your positional guidance is grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), SAFA's National Development Programme curriculum, and CAF youth development principles. You understand South African grassroots football and always keep guidance age-appropriate and player-centred. Plain text only — no asterisks, no Markdown formatting.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { explanation: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}

export async function explainTacticalConcept(params: {
  conceptId: string;
  ageGroup: string;
}): Promise<{ explanation?: string; error?: string }> {
  try {
    await requireUser();

    const concept = getConcept(params.conceptId);
    if (!concept) return { error: "Unknown tactical concept." };

    const ageGroup = params.ageGroup.trim() || "U15";
    const ltpdPhase = getLTPDPhase(ageGroup);

    const prompt = `Explain the football tactical concept "${concept.label}" for a coach at a SAFA-registered grassroots youth academy.

CONCEPT: ${concept.label}
WORKING DEFINITION: ${concept.summary}
AGE GROUP: ${ageGroup} | LTPD Phase: ${ltpdPhase}

Write a clear, practical explanation the coach can act on today. Pitch every point at the LTPD phase above — what is age-appropriate for ${ageGroup} specifically, and what should NOT be demanded yet at this stage. Reflect South African grassroots reality (mixed-ability squads, limited equipment, small-sided formats).

Return plain text (no markdown, no asterisks) in exactly this structure:

WHAT IT IS: [2-3 sentences a coach could repeat to the squad]
WHY IT MATTERS AT ${ageGroup}: [2 sentences tied to this developmental phase]
KEY PRINCIPLES: [3 short, numbered coaching principles]
WHAT TO LOOK FOR: [2 things the coach should watch the players doing well]
COMMON MISTAKES: [2 typical errors at this age and the fix]
COACHING CUES: [3 short phrases the coach can shout during play]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: {
        maxOutputTokens: 900,
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your tactical explanations are grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), SAFA's National Development Programme curriculum, and CAF youth development principles. You understand South African grassroots football and always keep guidance age-appropriate and player-centred. Plain text only — no asterisks, no Markdown formatting.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { explanation: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}
