"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import { getLTPDPhase, specialistSystem } from "@/lib/ai-safeguards";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { FORMATION_SIZES } from "@/lib/formations";
import { BOARD_H, BOARD_W, type BoardPlayer } from "@/lib/board-model";
import {
  MAX_SENTENCE_CHARS, MAX_SKETCH_SHAPES, MAX_ZONE_POINTS, buildBoard, formationMenu, validateBoardSketch,
} from "@/lib/board-from-text";
import { savePlay } from "./tactic-plays";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * "4-3-3, press high, left back overlapping" becomes a real play for the team.
 *
 * The result is ALWAYS inserted as a new play and never loaded over the open
 * board (the same rule as the suggested-XI Apply): a coach with work in
 * progress must not lose it to a sentence. The coach opens it from the list.
 *
 * `squadSize` is the board's current format (the size of the home formation
 * selected on it); a formation of another size is refused, not converted.
 */
export async function generateBoardFromSentence(params: {
  teamId: string;
  sentence: string;
  squadSize: number;
}): Promise<{ playId?: string; name?: string; dropped?: number; error?: string }> {
  try {
    const sentence = params.sentence.trim();
    if (!sentence) return { error: "Describe the play first, like \"4-3-3, press high, left back overlapping\"." };
    if (sentence.length > MAX_SENTENCE_CHARS) return { error: "That's a bit long. Try one or two short lines." };
    if (!(FORMATION_SIZES as number[]).includes(params.squadSize)) return { error: "Pick a formation on the board first." };

    const { supabase, user } = await requireUser();

    // Not redundant with RLS, which is academy-wide.
    const { data: team } = await supabase
      .from("teams")
      .select("id, age_group, team_members(active, players(id, full_name, position))")
      .eq("id", params.teamId)
      .in("id", await getCoachedTeamIds(supabase, user.id))
      .eq("active", true)
      .single();
    if (!team) return { error: "You don't coach this team." };

    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const ageGroup = ((team.age_group as string | null) ?? "").trim() || "U15";
    const prompt = `A youth football coach has described a play in a sentence. Turn it into a tactical board.

COACH'S SENTENCE: ${sentence}
AGE GROUP: ${ageGroup} | LTPD Phase: ${getLTPDPhase(ageGroup)}
THIS BOARD IS: ${params.squadSize}-a-side

FORMATIONS (id, label, size, then each slot as index=role(x,y)):
${formationMenu()}

COORDINATES: the pitch is ${BOARD_W} wide (x, left to right) and ${BOARD_H} tall (y). Our team defends the bottom goal (y=${BOARD_H}) and attacks upward toward y=0. Left and right are the team's own, as it faces up the pitch: a low x is the left flank.

Answer with:
- formationId: the id of the formation the sentence names (e.g. "4-3-3" is "11-4-3-3"). If it names none, choose the most sensible ${params.squadSize}-a-side one. If it names a formation, use it even when its size differs from the board; do not substitute another.
- name: a short name for the play, 4 words at most.
- shapes: at most ${MAX_SKETCH_SHAPES} drawings of what the sentence asks for, nothing else. Kinds: "run" (a player runs), "pass", "dribble", "shot", "press" (a pressing run), "zone" (a shaded area; set hatch true for "press here" areas). An arrow has fromSlot (the slot index of the player who does it, in YOUR chosen formation) and either toSlot (a teammate's slot, for a pass) or to {x,y}. A zone has pts, 3 to ${MAX_ZONE_POINTS} {x,y} corners. "Overlapping" is a run by the full back up the flank past the winger or midfielder in front of them. "Press high" is press arrows from the forwards and wide players toward the opposition's end, and/or a hatched zone in the final third.
Do not invent players or movements the sentence doesn't ask for.`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1200,
        // Direct-answer task: thinking tokens would eat the visible-output
        // budget and truncate the JSON with no error.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: specialistSystem({ focus: "tactics", plainText: "in every field" }),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            formationId: { type: Type.STRING },
            name: { type: Type.STRING },
            shapes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kind: { type: Type.STRING },
                  fromSlot: { type: Type.NUMBER },
                  toSlot: { type: Type.NUMBER },
                  to: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } },
                  pts: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } },
                  },
                  hatch: { type: Type.BOOLEAN },
                },
                required: ["kind"],
              },
            },
          },
          required: ["formationId", "name", "shapes"],
        },
      },
    });

    const checked = validateBoardSketch(parseJsonObject(response.text ?? ""), params.squadSize);
    if (!checked.ok) return { error: checked.error };

    const members = ((team.team_members ?? []) as unknown as {
      active: boolean;
      players: BoardPlayer | BoardPlayer[] | null;
    }[]);
    const roster: BoardPlayer[] = members
      .filter((m) => m.active && m.players)
      .flatMap((m) => (Array.isArray(m.players) ? m.players : [m.players!]));

    const { tokens, shapes } = buildBoard(checked.sketch, roster);
    const name = checked.sketch.name || sentence.slice(0, 40);

    // Always a new play: no playId, so savePlay inserts.
    const saved = await savePlay({
      teamId: params.teamId,
      name,
      data: {
        tokens, shapes, objects: [], playerNotes: [], frames: [],
        pitchId: "full", homeFormationId: checked.sketch.formationId,
      },
    });
    if (saved.error || !saved.id) return { error: saved.error ?? "Could not save the play." };
    return { playId: saved.id, name, dropped: checked.dropped };
  } catch (err) {
    return { error: aiError(err) };
  }
}
