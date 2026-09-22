"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";
import { buildSquadContext } from "./squad-context";
import { aiError, checkAiBudget } from "@/lib/ai-guard";

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
 * Parse a JSON-mode Gemini response into an object, the same way
 * player-import.ts's extractPlayersFromPdf does: try a straight JSON.parse
 * first, then fall back to the first `{...}` object in the text for when the
 * model wraps its JSON in prose despite the schema. Returns null rather than
 * throwing so callers can fall back to a plain error message.
 */
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

export interface LineupPick {
  position: string;
  name: string;
  reason: string;
}
export interface MustGetMinutes {
  name: string;
  why: string;
}
export interface LineupStructured {
  shape: string;
  startingXI: LineupPick[];
  bench: string[];
  mustGetMinutes: MustGetMinutes[];
  notes: string;
}

/**
 * Renders the exact prose shape the old freeform prompt asked the model
 * for, from the now-structured data, so every existing AiProse call site
 * (coach-assistant-panel.tsx) keeps reading exactly as it did before this
 * became structured — no second model call for the prose, just a template.
 */
function renderLineupProse(s: LineupStructured, fallbackFormation: string): string {
  const lines: string[] = [];
  lines.push(`SHAPE: ${s.shape || fallbackFormation}`);
  lines.push("STARTING XI:");
  for (const p of s.startingXI) lines.push(`${p.position} — ${p.name} — ${p.reason}`);
  lines.push(`BENCH: ${s.bench.join(", ")}`);
  lines.push(`MUST GET MINUTES: ${s.mustGetMinutes.map((m) => `${m.name} (${m.why})`).join("; ")}`);
  lines.push(`SELECTION NOTES: ${s.notes}`);
  return lines.join("\n");
}

export interface MatchPlanStructured {
  planSummary: string;
  shapeAndWhy: string;
  inPossession: string[];
  outOfPossession: string[];
  setPieces: { attacking: string; defending: string };
  keyPlayers: { name: string; job: string }[];
  worries: string[];
  teamTalk: string[];
  rehearseAtTraining: string;
}

function renderMatchPlanProse(s: MatchPlanStructured): string {
  const lines: string[] = [];
  lines.push(`THE PLAN IN A SENTENCE: ${s.planSummary}`);
  lines.push(`OUR SHAPE AND WHY: ${s.shapeAndWhy}`);
  lines.push("IN POSSESSION:");
  s.inPossession.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  lines.push("OUT OF POSSESSION:");
  s.outOfPossession.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
  lines.push(`SET PIECES: Attacking — ${s.setPieces.attacking} Defending — ${s.setPieces.defending}`);
  lines.push("KEY PLAYERS:");
  s.keyPlayers.forEach((p) => lines.push(`- ${p.name} — ${p.job}`));
  lines.push("WHAT WORRIES ME:");
  s.worries.forEach((w) => lines.push(`- ${w}`));
  lines.push("TEAM TALK:");
  s.teamTalk.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push(`REHEARSE AT TRAINING: ${s.rehearseAtTraining}`);
  return lines.join("\n");
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
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };


    const question = params.question.trim();
    if (!question) return { error: "Ask a question first." };
    if (question.length > 1000) return { error: "That question is a bit long — try trimming it." };

    const { context, error } = await buildSquadContext(params.teamId);
    if (error || !context) return { error: error ?? "Could not load the squad." };

    // Keep the transcript bounded so long chats stay cheap and fast.
    const history = params.history.slice(-8);

    // Gemini requires turns to strictly alternate user/model. A question that
    // errored client-side stays in the transcript with no matching model
    // reply (so the failed question is still visible to the coach) — but
    // resending it as history here would put two "user" turns back to back
    // right before the new question, and Gemini rejects that with a 400
    // INVALID_ARGUMENT. Drop any trailing unanswered user turn(s) so history
    // always ends on a model turn (or is empty).
    while (history.length > 0 && history[history.length - 1].role === "user") {
      history.pop();
    }

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

    // thinkingBudget: 0 — a direct-answer task; unbudgeted thinking tokens
    // were silently eating the visible-output budget, truncating replies.
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents,
      config: { maxOutputTokens: 900, thinkingConfig: { thinkingBudget: 0 }, systemInstruction: COACH_SYSTEM },
    });

    const text = (response.text ?? "").replace(/\*/g, "");
    return { answer: text || "I couldn't produce an answer — try rephrasing." };
  } catch (err) {
    return { error: aiError(err) };
  }
}

/** Suggest a starting XI for a fixture, with the reasoning behind each pick. */
export async function suggestLineup(params: {
  teamId: string;
  fixtureId?: string;
  formation: string;
}): Promise<{ lineup?: string; structured?: LineupStructured; error?: string }> {
  try {
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const { context, error } = await buildSquadContext(params.teamId, { fixtureId: params.fixtureId });
    if (error || !context) return { error: error ?? "Could not load the squad." };

    const prompt = `Pick a starting XI from this squad for the next match, playing ${params.formation}.

${context.brief}

Selection rules:
- Only pick players listed in the squad above, by their exact name.
- Never select a player flagged INJURED, UNAVAILABLE or listed under UNAVAILABLE in the brief — not in the starting XI, not on the bench. If one would otherwise have been an obvious pick, say so and name who takes their place instead.
- Weight recent form and average rating, but respect each player's actual position.
- Training attendance matters: a player well below the 75% threshold should not walk into the team ahead of someone who trains. Say so when it affects a pick.
- These are children at ${context.ageGroup}: everyone should get football, so name the bench and say who must get minutes.
- If the squad is too small for the shape, say that plainly.

Return the starting XI (one entry per outfield role in ${params.formation}), the bench, 1-2 players who must get minutes and why, and 2 sentences of selection notes on the balance of the side and any risk.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: COACH_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shape: { type: Type.STRING },
            startingXI: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  position: { type: Type.STRING },
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ["position", "name", "reason"],
              },
            },
            bench: { type: Type.ARRAY, items: { type: Type.STRING } },
            mustGetMinutes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, why: { type: Type.STRING } },
                required: ["name", "why"],
              },
            },
            notes: { type: Type.STRING },
          },
          required: ["shape", "startingXI", "bench", "mustGetMinutes", "notes"],
        },
      },
    });

    const parsed = parseJsonObject(response.text ?? "");
    if (!parsed) return { error: "Could not read the AI's suggestion. Try again." };
    const structured = parsed as unknown as LineupStructured;
    const lineup = renderLineupProse(structured, params.formation).replace(/\*/g, "");
    return { lineup, structured };
  } catch (err) {
    return { error: aiError(err) };
  }
}

/** Full pre-match plan for a fixture, including anything known about the opponent. */
export async function generateMatchPlan(params: {
  teamId: string;
  fixtureId: string;
}): Promise<{ plan?: string; structured?: MatchPlanStructured; error?: string }> {
  try {
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const { context, error } = await buildSquadContext(params.teamId, { fixtureId: params.fixtureId });
    if (error || !context) return { error: error ?? "Could not load the squad." };

    const prompt = `Write the match plan for this team's next fixture.

${context.brief}

Use the squad's real names and numbers. Never build the plan or key players around a player flagged INJURED, UNAVAILABLE or listed under UNAVAILABLE in the brief. If we have played this opponent before, use what happened last time and say what to change. If we have never played them, say the plan is based on our own strengths and what to check in the warm-up.

Produce: one sentence the squad could repeat as the plan; 2 sentences on our shape and why; exactly 3 in-possession instructions; exactly 3 out-of-possession instructions; one attacking and one defending set-piece instruction; exactly 2 key players by name and their job on the day; exactly 2 risks based on the data above; exactly 3 short team-talk points in plain language a young player understands; and one sentence on what to rehearse at training this week.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1500,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: COACH_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            planSummary: { type: Type.STRING },
            shapeAndWhy: { type: Type.STRING },
            inPossession: { type: Type.ARRAY, items: { type: Type.STRING } },
            outOfPossession: { type: Type.ARRAY, items: { type: Type.STRING } },
            setPieces: {
              type: Type.OBJECT,
              properties: { attacking: { type: Type.STRING }, defending: { type: Type.STRING } },
              required: ["attacking", "defending"],
            },
            keyPlayers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { name: { type: Type.STRING }, job: { type: Type.STRING } },
                required: ["name", "job"],
              },
            },
            worries: { type: Type.ARRAY, items: { type: Type.STRING } },
            teamTalk: { type: Type.ARRAY, items: { type: Type.STRING } },
            rehearseAtTraining: { type: Type.STRING },
          },
          required: [
            "planSummary", "shapeAndWhy", "inPossession", "outOfPossession",
            "setPieces", "keyPlayers", "worries", "teamTalk", "rehearseAtTraining",
          ],
        },
      },
    });

    const parsed = parseJsonObject(response.text ?? "");
    if (!parsed) return { error: "Could not read the AI's match plan. Try again." };
    const structured = parsed as unknown as MatchPlanStructured;
    const plan = renderMatchPlanProse(structured).replace(/\*/g, "");
    return { plan, structured };
  } catch (err) {
    return { error: aiError(err) };
  }
}
