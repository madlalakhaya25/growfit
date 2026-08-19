"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function generateDevelopmentPlan(playerId: string): Promise<{
  plan?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireUser();

    const { data: profile } = await supabase
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .single();

    const [playerResult, attrsResult, ratingsResult, completionsResult] = await Promise.all([
      supabase
        .from("players")
        .select("full_name, position, date_of_birth")
        .eq("id", playerId)
        .single(),

      supabase
        .from("player_attributes")
        .select("pace, shooting, passing, dribbling, defending, physical, assessed_at")
        .eq("player_id", playerId)
        .order("assessed_at", { ascending: false })
        .limit(1)
        .single(),

      supabase
        .from("player_ratings")
        .select("rating, note, created_at, fixtures(opponent, fixture_date)")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(8),

      supabase
        .from("player_milestone_completions")
        .select("template_id, completed_at, development_milestone_templates(title, category)")
        .eq("player_id", playerId)
        .order("completed_at", { ascending: false })
        .limit(10),
    ]);

    const player = playerResult?.data;
    if (!player) return { error: "Player not found." };

    const attrs = attrsResult?.data;
    const ratings = ratingsResult?.data ?? [];
    const completions = completionsResult?.data ?? [];

    // Fetch incomplete milestones (templates the player has NOT completed)
    let incompleteMilestones: { title: string }[] = [];
    if (profile?.academy_id) {
      const completedTemplateIds = (completions as any[]).map((c) => c.template_id);

      const { data: allTemplates } = await supabase
        .from("development_milestone_templates")
        .select("id, title")
        .eq("academy_id", profile.academy_id)
        .limit(50);

      if (allTemplates) {
        incompleteMilestones = (allTemplates as { id: string; title: string }[])
          .filter((t) => !completedTemplateIds.includes(t.id))
          .slice(0, 5);
      }
    }

    // Calculate age
    const age = player.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(player.date_of_birth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
        )
      : null;

    // Build sorted attributes (strongest to weakest)
    let attrSummary = "No attribute assessments yet";
    if (attrs) {
      const attrEntries = [
        { label: "Pace", value: attrs.pace },
        { label: "Shooting", value: attrs.shooting },
        { label: "Passing", value: attrs.passing },
        { label: "Dribbling", value: attrs.dribbling },
        { label: "Defending", value: attrs.defending },
        { label: "Physical", value: attrs.physical },
      ].sort((a, b) => b.value - a.value);
      attrSummary = attrEntries.map((e) => `${e.label}: ${e.value}`).join(", ");
    }

    // Build ratings summary
    const ratingsSummary = ratings.length
      ? (ratings as any[])
          .map((r) => {
            const fix = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
            return `${r.rating}/5 vs ${fix?.opponent ?? "training"}`;
          })
          .join("; ")
      : "No recent ratings";

    // Build completed milestones summary
    const completedMilestoneSummary = completions.length
      ? (completions as any[])
          .map((c) => {
            const t = Array.isArray(c.development_milestone_templates)
              ? c.development_milestone_templates[0]
              : c.development_milestone_templates;
            return t ? t.title : null;
          })
          .filter(Boolean)
          .join(", ")
      : "None recorded";

    // Build priority gaps summary
    const priorityGapsSummary = incompleteMilestones.length
      ? incompleteMilestones.map((m) => m.title).join(", ")
      : "None identified";

    const prompt = `You are an elite youth football development coach. Create a focused 4-week personal development plan for the following player.

RULES:
- Use third person (the player's name)
- NO markdown, no asterisks, no bolding
- Total response: 200-250 words
- Use these exact plain text section headers

Player: ${player.full_name}, Position: ${player.position ?? "Unknown"}, Age: ${age ?? "Unknown"}
Attributes (strongest to weakest): ${attrSummary}
Recent form: ${ratingsSummary}
Completed milestones: ${completedMilestoneSummary}
Priority gaps: ${priorityGapsSummary}

Output format:
1. PLAYER SUMMARY: (2 sentences on current level and position fit)
2. WEEK 1-2 FOCUS: (2 specific training goals with drills)
3. WEEK 3-4 PROGRESSION: (2 advanced goals building on weeks 1-2)
4. KEY TARGETS: (3 measurable targets to hit by end of plan)
5. COACH NOTE: (one motivational sentence for the coach to share)`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 600,
        systemInstruction:
          "You are an elite youth football development coach creating personalised, actionable 4-week development plans. Write in plain text only — no asterisks, no markdown, no bolding.",
      },
    });

    let text = response.text ?? "";

    if (!text) {
      throw new Error("No response from Gemini");
    }

    text = text.replace(/\*/g, "");

    return { plan: text };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI service unavailable.",
    };
  }
}
