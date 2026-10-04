"use server";

import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import { getLTPDPhase, specialistSystem } from "@/lib/ai-safeguards";
import { requireUser } from "@/lib/auth";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { generateWithRetry } from "@/lib/ai-resilient";
import {
  INSTRUCTION_ACTIONS, MAX_INSTRUCTIONS, MAX_INSTRUCTION_CHARS, actionMenu, validateInstructions,
  type Instruction,
} from "@/lib/board-instructions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * "Left back overlaps, the 10 drops" becomes a list of fixed actions. The model
 * answers with action names and player numbers only; where anyone runs is
 * worked out by lib/board-instructions.ts, so a coach can never be shown a
 * movement the app did not compute. Nothing is saved or drawn here: the board
 * previews the list and the coach presses Apply.
 *
 * `players` is our team as the board shows it (menu text built by
 * playersMenu), and `count` is how many there are, so a player number outside
 * the list is dropped.
 */
export async function interpretBoardInstructions(params: {
  teamId: string;
  sentence: string;
  playersMenu: string;
  count: number;
}): Promise<{ instructions?: Instruction[]; dropped?: number; error?: string }> {
  try {
    const sentence = params.sentence.trim();
    if (!sentence) return { error: "Tell the board what you want, like \"left back overlaps, the 10 drops\"." };
    if (sentence.length > MAX_INSTRUCTION_CHARS) return { error: "That's a bit long. Try one or two short lines." };
    if (!Number.isInteger(params.count) || params.count < 1 || params.count > 22) return { error: "Put your players on the board first." };

    const { supabase, user } = await requireUser();
    const { data: team } = await supabase
      .from("teams")
      .select("id, age_group")
      .eq("id", params.teamId)
      .in("id", await getCoachedTeamIds(supabase, user.id))
      .eq("active", true)
      .single();
    if (!team) return { error: "You don't coach this team." };

    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const ageGroup = ((team.age_group as string | null) ?? "").trim() || "U15";
    const prompt = `A youth football coach has told the tactics board how the team should move. Turn it into a list of actions.

COACH'S WORDS: ${sentence}
AGE GROUP: ${ageGroup} | LTPD Phase: ${getLTPDPhase(ageGroup)}

OUR PLAYERS (number = label (line, side, third)). Our team attacks toward the attacking third; left and right are the team's own:
${params.playersMenu.slice(0, 2000)}

ACTIONS YOU MAY USE (nothing else):
${actionMenu()}

Answer with instructions: at most ${MAX_INSTRUCTIONS}, each with action, player (the number from the list above, of the player who does it), and where the action needs it a target (the number of the teammate) or direction ("left" or "right"). "Left back" is the defender on the left; "the 10" is the attacking midfielder. If the coach names a group ("back four shift across", "strikers press"), give one instruction per player in that group. Do not give coordinates. Do not invent movements the coach did not ask for. If you cannot match a player, leave that instruction out.`;

    const response = await generateWithRetry(ai, {
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 1000,
        // Direct-answer task: thinking tokens would eat the visible-output
        // budget and truncate the JSON with no error.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: specialistSystem({ focus: "tactics", plainText: "in every field" }),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            instructions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING, enum: [...INSTRUCTION_ACTIONS] },
                  player: { type: Type.NUMBER },
                  target: { type: Type.NUMBER },
                  direction: { type: Type.STRING, enum: ["left", "right"] },
                },
                required: ["action", "player"],
              },
            },
          },
          required: ["instructions"],
        },
      },
    });

    const checked = validateInstructions(parseJsonObject(response.text ?? ""), params.count);
    if (!checked.ok) return { error: checked.error };
    return { instructions: checked.instructions, dropped: checked.dropped };
  } catch (err) {
    return { error: aiError(err) };
  }
}
