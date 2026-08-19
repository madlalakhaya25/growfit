"use server";

import { GoogleGenAI } from "@google/genai";
import { requireUser } from "@/lib/auth";
import { buildSquadContext } from "./squad-context";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const COACH_SYSTEM =
  "You are the assistant coach at Growfit Sports Academy, a SAFA-registered grassroots youth academy in Greater Durban, South Africa. " +
  "You are grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model, SAFA's National Development Programme curriculum, and CAF youth development principles. " +
  "You are given a brief with the squad's real data. Always use the real player names and real numbers from that brief — never invent a player, a rating, a result or a statistic that is not in it. If the brief does not contain what is needed, say so plainly and say what the coach should record. " +
  "The academy's attendance policy is 75% per term, and dropping below it triggers a welfare check-in, not a punishment. " +
  "These are children: player welfare and long-term development always outrank winning a single match. Never suggest anti-football, time-wasting, or playing an injured or unwell child. " +
  "Never repeat a child's medical details, ID number or contact information. " +
  "Answer like an experienced coach talking to a colleague: direct, practical, and short. Plain text only — no asterisks, no Markdown formatting.";

export interface CoachMessage {
  role: "user" | "model";
  text: string;
}

/**
 * Conversational, squad-aware assistant. The squad brief is re-sent each turn
 * (rather than kept server-side) so the answer always reflects current data,
 * and the caller keeps the transcript.
 */
export async function askCoachAssistant(params: {
  teamId: string;
  history: CoachMessage[];
  question: string;
}): Promise<{ answer?: string; error?: string }> {
  try {
    await requireUser();

    const question = params.question.trim();
    if (!question) return { error: "Ask a question first." };
    if (question.length > 1000) return { error: "That question is a bit long — try trimming it." };

    const { context, error } = await buildSquadContext(params.teamId);
    if (error || !context) return { error: error ?? "Could not load the squad." };

    // Keep the transcript bounded so long chats stay cheap and fast.
    const history = params.history.slice(-8);

    const contents = [
      {
        role: "user" as const,
        parts: [{ text: `Here is the current squad brief. Use it for every answer.\n\n${context.brief}` }],
      },
      {
        role: "model" as const,
        parts: [{ text: `Understood. I have the ${context.teamName} squad in front of me and will use their real data.` }],
      },
      ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: "user" as const, parts: [{ text: question }] },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents,
      config: { maxOutputTokens: 900, systemInstruction: COACH_SYSTEM },
    });

    const text = (response.text ?? "").replace(/\*/g, "");
    return { answer: text || "I couldn't produce an answer — try rephrasing." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}

/** Suggest a starting XI for a fixture, with the reasoning behind each pick. */
export async function suggestLineup(params: {
  teamId: string;
  fixtureId?: string;
  formation: string;
}): Promise<{ lineup?: string; error?: string }> {
  try {
    await requireUser();
    const { context, error } = await buildSquadContext(params.teamId, { fixtureId: params.fixtureId });
    if (error || !context) return { error: error ?? "Could not load the squad." };

    const prompt = `Pick a starting XI from this squad for the next match, playing ${params.formation}.

${context.brief}

Selection rules:
- Only pick players listed in the squad above, by their exact name.
- Weight recent form and average rating, but respect each player's actual position.
- Training attendance matters: a player well below the 75% threshold should not walk into the team ahead of someone who trains. Say so when it affects a pick.
- These are children at ${context.ageGroup}: everyone should get football, so name the bench and say who must get minutes.
- If the squad is too small for the shape, say that plainly.

Return plain text (no markdown, no asterisks) in exactly this structure:

SHAPE: ${params.formation}
STARTING XI:
[one line per player: Position — Name — one short reason]
BENCH: [names, comma separated]
MUST GET MINUTES: [1-2 names who need game time, and why]
SELECTION NOTES: [2 sentences on the balance of the side and any risk]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: { maxOutputTokens: 1000, systemInstruction: COACH_SYSTEM },
    });

    const text = (response.text ?? "").replace(/\*/g, "");
    return { lineup: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}

/** Full pre-match plan for a fixture, including anything known about the opponent. */
export async function generateMatchPlan(params: {
  teamId: string;
  fixtureId: string;
}): Promise<{ plan?: string; error?: string }> {
  try {
    await requireUser();
    const { context, error } = await buildSquadContext(params.teamId, { fixtureId: params.fixtureId });
    if (error || !context) return { error: error ?? "Could not load the squad." };

    const prompt = `Write the match plan for this team's next fixture.

${context.brief}

Use the squad's real names and numbers. If we have played this opponent before, use what happened last time and say what to change. If we have never played them, say the plan is based on our own strengths and what to check in the warm-up.

Return plain text (no markdown, no asterisks) in exactly this structure:

THE PLAN IN A SENTENCE: [one sentence the squad could repeat]
OUR SHAPE AND WHY: [2 sentences]
IN POSSESSION: [3 numbered instructions]
OUT OF POSSESSION: [3 numbered instructions]
SET PIECES: [1 attacking and 1 defending instruction]
KEY PLAYERS: [2 of our players by name and their job on the day]
WHAT WORRIES ME: [2 risks, based on the data above]
TEAM TALK: [3 short points to say before kick-off, in plain language a young player understands]
REHEARSE AT TRAINING: [1 sentence on what to drill this week]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: { maxOutputTokens: 1200, systemInstruction: COACH_SYSTEM },
    });

    const text = (response.text ?? "").replace(/\*/g, "");
    return { plan: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}
