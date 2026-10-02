"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL_LITE } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { generateOrServeText } from "@/lib/ai-cached";
import { PLAYER_FACING_RULE } from "@/lib/ai-safeguards";
import { requireStaff } from "@/lib/auth";
import {
  MAX_REWRITE_CHARS, ageFromAgeGroup, cleanRewrite, missingNumbers, rewriteBrief, rewriteSubjectId,
} from "@/lib/age-rewrite";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface AgeRewriteResult {
  text?: string;
  /** Figures in the original that the rewrite dropped; the coach should check them. */
  missing?: string[];
  cached?: boolean;
  /** False when generated but not saved (migration 050 pending). */
  persisted?: boolean;
  error?: string;
}

/**
 * A coach's note in language a child of this age can follow, on the light model.
 * The coach reads it and chooses whether to use it, so it is never sent to
 * anyone from here. Cached per (age, exact note): the same note rewritten twice
 * costs one model call, and a cache hit spends none of the coach's budget.
 */
export async function rewriteForAge(params: { text: string; ageGroup: string | number }): Promise<AgeRewriteResult> {
  try {
    const { supabase, user, profile } = await requireStaff();
    if (!profile?.academy_id) return { error: "Coaches and admins only." };

    const text = params.text.trim();
    if (!text) return { error: "Write the message first, then simplify it." };
    if (text.length > MAX_REWRITE_CHARS) return { error: "That's a bit long to simplify in one go. Try it in parts." };
    const age = ageFromAgeGroup(params.ageGroup);
    if (age === null) return { error: "This team has no age group set, so there's no reading level to aim for." };

    const res = await generateOrServeText(supabase, {
      kind: "age_rewrite",
      subjectType: "text",
      subjectId: rewriteSubjectId(text, age),
      academyId: profile.academy_id,
      userId: user.id,
      brief: rewriteBrief(text, age),
      modelId: AI_MODEL_LITE,
      beforeGenerate: () => checkAiBudget(user.id),
      generate: async () => {
        const response = await ai.models.generateContent({
          model: AI_MODEL_LITE,
          contents: `Rewrite this note from a youth football coach so a ${age}-year-old can read and follow it.\n\n${text}`,
          config: {
            maxOutputTokens: 700,
            // Direct-answer task: thinking tokens would eat the visible-output
            // budget and truncate the answer with no error.
            thinkingConfig: { thinkingBudget: 0 },
            systemInstruction:
              `You rewrite coaches' messages for children in South African grassroots football. ${PLAYER_FACING_RULE} ` +
              `Use short sentences and everyday words a ${age}-year-old knows, in warm, direct "you" language. ` +
              "Keep every fact exactly: names, days, dates, times, places, amounts and numbers, and what is being asked of them. " +
              "Never add a fact, a promise or a rule that is not in the note. Keep it about the same length or shorter. " +
              "Reply with the rewritten note only, in plain text with no asterisks, no quotes and no emoji.",
          },
        });
        return { text: cleanRewrite(response.text ?? ""), response };
      },
    });
    if (res.error) return { error: res.error };
    if (!res.text) return { error: "Could not simplify that. Try again." };

    const missing = missingNumbers(text, res.text);
    return { text: res.text, cached: res.cached, persisted: res.persisted, ...(missing.length ? { missing } : {}) };
  } catch (err) {
    return { error: aiError(err) };
  }
}
