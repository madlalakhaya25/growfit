"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL, AI_MODEL_LITE } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";
import { getConcept } from "@/lib/tactics";
import { buildSquadContext } from "./squad-context";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import { FORMATIONS } from "@/lib/formations";
import { ZONE_IDS, zoneLabel } from "@/lib/board-analysis";
import { validateCounter, renderCounterProse, type OpponentCounter } from "@/lib/opponent-counter";
import { getOpponentScouting } from "./tactic-plays";

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
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };


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
      // Fixed-structure definition, no squad data or selection call riding
      // on it — the cheap tier (see ai-models.ts).
      model: AI_MODEL_LITE,
      contents: prompt,
      config: {
        maxOutputTokens: 900,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your positional guidance is grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), SAFA's National Development Programme curriculum, and CAF youth development principles. You understand South African grassroots football and always keep guidance age-appropriate and player-centred. Plain text only — no asterisks, no Markdown formatting.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { explanation: text };
  } catch (err) {
    return { error: aiError(err) };
  }
}

export async function explainTacticalConcept(params: {
  conceptId: string;
  ageGroup: string;
  teamId?: string;
}): Promise<{ explanation?: string; error?: string }> {
  try {
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };


    const concept = getConcept(params.conceptId);
    if (!concept) return { error: "Unknown tactical concept." };

    // Ground the explanation in this squad's real numbers when we have a team.
    let squadNote = "";
    if (params.teamId) {
      const { context } = await buildSquadContext(params.teamId);
      if (context) {
        squadNote = `\n\nTHIS COACH'S ACTUAL SQUAD — tailor the advice to these players and cite their real numbers where relevant. Never invent a player or a statistic that is not listed:\n${context.brief}`;
      }
    }

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
COACHING CUES: [3 short phrases the coach can shout during play]${squadNote}`;

    const response = await ai.models.generateContent({
      // Fixed-structure definition — the cheap tier (see ai-models.ts) even
      // when a squad brief is attached, since the answer is still a
      // definition, not a decision about who plays.
      model: AI_MODEL_LITE,
      contents: prompt,
      config: {
        maxOutputTokens: 1000,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your tactical explanations are grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model (Technical, Tactical, Physical, Social/Psychological), SAFA's National Development Programme curriculum, and CAF youth development principles. You understand South African grassroots football and always keep guidance age-appropriate and player-centred. Plain text only — no asterisks, no Markdown formatting.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { explanation: text };
  } catch (err) {
    return { error: aiError(err) };
  }
}

/**
 * Describe a play drawn on the tactical board. The board state is summarised
 * into text (positions by zone, drawn runs/passes, movement steps) and the
 * model turns that into coaching points — so the description follows what the
 * coach actually drew rather than inventing a play.
 */
export async function describePlay(params: {
  playName: string;
  ageGroup: string;
  conceptLabels: string[];
  summary: string;
}): Promise<{ description?: string; error?: string }> {
  try {
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };


    const ageGroup = params.ageGroup.trim() || "U15";
    const ltpdPhase = getLTPDPhase(ageGroup);
    const concepts = params.conceptLabels.length
      ? params.conceptLabels.join(", ")
      : "not tagged";

    const prompt = `A youth football coach has drawn a play on a tactical board. Turn it into coaching points.

PLAY NAME: ${params.playName || "Untitled play"}
AGE GROUP: ${ageGroup} | LTPD Phase: ${ltpdPhase}
TAGGED CONCEPTS: ${concepts}

BOARD DESCRIPTION (generated from what the coach drew):
${params.summary}

Describe what this play is doing and how to coach it, pitched at the LTPD phase above. Work only from the board description — do not invent players or movements that are not listed. If the board is sparse, say what the coach should add.

Return plain text (no markdown, no asterisks) in exactly this structure:

WHAT THIS PLAY DOES: [2-3 sentences]
KEY MOMENTS: [3 numbered moments in the sequence and what matters at each]
COACHING POINTS: [3 numbered points to emphasise at ${ageGroup}]
WHAT TO WATCH FOR: [2 signs it is working]
PROGRESSION: [1 sentence on how to make it harder once they master it]`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 900,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist. Your guidance is grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model, SAFA's National Development Programme curriculum, and CAF youth development principles. You understand South African grassroots football and keep everything age-appropriate and player-centred. Plain text only — no asterisks, no Markdown formatting.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");
    return { description: text };
  } catch (err) {
    return { error: aiError(err) };
  }
}

/**
 * Analyse the opponent's shape on the board and advise how to counter it —
 * as data the board can draw, not just prose. The model is given the
 * geometric reading from board-analysis.ts (so it builds on the gaps that
 * are actually on the pitch rather than on a formation name), the zone grid
 * to anchor every suggestion to, the formations of our size it may suggest,
 * and — when the play is linked to a fixture — what we know about this
 * opponent from past meetings. Everything it returns is validated by
 * lib/opponent-counter.ts before the board sees it.
 */
export async function analyseOpponent(params: {
  ageGroup: string;
  teamId: string;
  fixtureId?: string;
  opponentFormation: string;
  ourFormationId: string;
  summary: string;
  /** board-analysis.ts describeReading() of the current board. */
  reading: string;
}): Promise<{ analysis?: string; counter?: OpponentCounter; error?: string }> {
  try {
    const { user } = await requireUser();
    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const ageGroup = params.ageGroup.trim() || "U15";
    const ltpdPhase = getLTPDPhase(ageGroup);
    const ours = FORMATIONS.find((f) => f.id === params.ourFormationId);
    const options = FORMATIONS.filter((f) => !ours || f.size === ours.size);

    let history = "";
    if (params.fixtureId && params.teamId) {
      const { scouting } = await getOpponentScouting(params.teamId, params.fixtureId);
      if (scouting) {
        const lines = [`OPPONENT: ${scouting.opponent}`];
        if (scouting.formations.length) {
          lines.push(`Shapes our coaches have set them up in before: ${scouting.formations.map((f) => `${f.label} (${f.count}x)`).join(", ")}.`);
        }
        if (scouting.results.length) {
          lines.push("Previous results against them (ours first):");
          scouting.results.forEach((r) => lines.push(`- ${r.when}: ${r.score}${r.notes ? ` — notes: ${r.notes}` : ""}`));
        } else {
          lines.push("No logged result against them yet.");
        }
        history = `\n\nWHAT WE KNOW ABOUT THIS OPPONENT (use it; never invent results that are not listed):\n${lines.join("\n")}`;
      }
    }

    const prompt = `A youth football coach has set up an opponent's shape on a tactical board. Read it and give a counter the board can draw.

OUR SHAPE: ${ours?.label ?? "custom"}
OPPONENT SHAPE: ${params.opponentFormation}
AGE GROUP: ${ageGroup} | LTPD Phase: ${ltpdPhase}

BOARD DESCRIPTION (generated from what the coach placed):
${params.summary}

GAPS MEASURED ON THE BOARD (most promising first, zone id in brackets):
${params.reading}${history}

PITCH ZONES — we attack upward toward their goal; left/right are OUR left and right. Refer to places only by these ids:
${ZONE_IDS.map((z) => `${z} = ${zoneLabel(z)}`).join("\n")}

FORMATIONS YOU MAY SUGGEST (use the id exactly):
${options.map((f) => `${f.id} = ${f.label} (${f.format})`).join("\n")}

Build on the measured gaps above — do not invent opponent players or movements that are not on the board. Pitch the advice at the LTPD phase above and at South African grassroots football with mixed-ability squads. At this age the priority is the players' development, so never advise anti-football or time-wasting.

Return: reading (2-3 sentences on what their shape is doing); exploits (2-3 zones to attack, each with why the space is there and how to use it, in words a young player understands); counterFormationId (one id from the list) and counterFormationWhy (one sentence); counterRuns (2-3 movements that attack those zones — each from a zone to a zone, kind run, pass or dribble, and a short note naming the role, e.g. "Left winger runs in behind"); watchOut (2 threats their shape poses to us); trainThisWeek (one sentence on what to rehearse).`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1400,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You are a UEFA Pro Licence and SAFA Level 4 Coaching Badge qualified youth development specialist and opposition analyst. Your advice is grounded in FIFA's Long-Term Player Development (LTPD) framework, the 4-Corner Player Development Model, SAFA's National Development Programme curriculum, and CAF youth development principles. You understand South African grassroots football. Player development always outranks winning a single match. Plain text inside every field — no asterisks, no Markdown formatting.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reading: { type: Type.STRING },
            exploits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  zoneId: { type: Type.STRING, format: "enum", enum: ZONE_IDS },
                  why: { type: Type.STRING },
                  howTo: { type: Type.STRING },
                },
                required: ["zoneId", "why", "howTo"],
              },
            },
            counterFormationId: { type: Type.STRING, format: "enum", enum: options.map((f) => f.id) },
            counterFormationWhy: { type: Type.STRING },
            counterRuns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fromZoneId: { type: Type.STRING, format: "enum", enum: ZONE_IDS },
                  toZoneId: { type: Type.STRING, format: "enum", enum: ZONE_IDS },
                  kind: { type: Type.STRING, format: "enum", enum: ["run", "pass", "dribble"] },
                  note: { type: Type.STRING },
                },
                required: ["fromZoneId", "toZoneId", "kind", "note"],
              },
            },
            watchOut: { type: Type.ARRAY, items: { type: Type.STRING } },
            trainThisWeek: { type: Type.STRING },
          },
          required: ["reading", "exploits", "counterFormationId", "counterFormationWhy", "counterRuns", "watchOut", "trainThisWeek"],
        },
      },
    });

    const counter = validateCounter(parseJsonObject(response.text ?? ""), ours?.size);
    if (!counter) return { error: "Could not read the AI's counter. Try again." };
    return { analysis: renderCounterProse(counter), counter };
  } catch (err) {
    return { error: aiError(err) };
  }
}
