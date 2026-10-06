"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { APPROVAL_RULE } from "@/lib/ai-safeguards";
import { requireStaff } from "@/lib/auth";
import { generateWithRetry } from "@/lib/ai-resilient";
import { loadCurriculum } from "@/lib/curriculum-data";
import { curriculumAgeGroupFromTeam, groupForAgeGroup } from "@/lib/curriculum";
import {
  COPILOT_SECTIONS, MAX_COPILOT_PROBLEM, copilotBrief, parseCopilot, type CopilotSection,
} from "@/lib/copilot";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface CopilotResult {
  sections?: CopilotSection[];
  error?: string;
}

/**
 * Helps a coach think a match problem through: causes, questions to ask,
 * session ideas tied to the academy's own curriculum. It is a draft for that
 * coach only and is not stored or sent anywhere. The model is shown the
 * problem, the age group and curriculum titles; never a child's name.
 */
export async function thinkItThrough(params: { problem: string; ageGroup: string | null }): Promise<CopilotResult> {
  try {
    const { supabase, user, profile } = await requireStaff();
    if (!profile?.academy_id) return { error: "Coaches and admins only." };

    const problem = params.problem.trim();
    if (!problem) return { error: "Name the problem first, then think it through." };
    if (problem.length > MAX_COPILOT_PROBLEM) return { error: "That's a bit long. Say it in a sentence or two." };

    const curriculumAge = curriculumAgeGroupFromTeam(params.ageGroup);
    const curriculum = await loadCurriculum(supabase);
    const titles = curriculumAge && curriculum.available
      ? groupForAgeGroup(curriculum.items, curriculumAge).flatMap((g) => g.items.map((i) => i.title))
      : [];

    const budget = await checkAiBudget(user.id);
    if (budget) return { error: budget };

    const response = await generateWithRetry(ai, {
      model: AI_MODEL,
      contents: copilotBrief({ problem, ageGroup: params.ageGroup, curriculumTitles: titles }),
      config: {
        maxOutputTokens: 1800,
        // Direct-answer task: thinking tokens would eat the visible-output
        // budget and truncate the answer with no error.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You help a volunteer youth football coach in South African grassroots football think a problem through, so they learn the reasoning, not just the answer. " +
          `${APPROVAL_RULE} The problem is about the team, never about a child; do not name or blame any child. ` +
          "Children's welfare and long-term development outrank winning. Say plainly when you are unsure or when the cause could be several things. " +
          "Session ideas must be safe for the age group and, where the curriculum list is given, point at items from it using their exact wording. " +
          `Answer in exactly these sections, each starting on its own line with the heading in capitals: ${COPILOT_SECTIONS.map((s) => s.heading).join(", ")}. ` +
          "Keep each section short: two to four brief lines. Plain text only, no asterisks, no Markdown.",
      },
    });
    const sections = parseCopilot(response.text ?? "");
    if (!sections) return { error: "Could not think that through. Try again." };
    return { sections };
  } catch (err) {
    return { error: aiError(err) };
  }
}
