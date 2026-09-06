"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";
import { calculateAge } from "@/lib/player";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateParentReport(
  playerId: string
): Promise<{ report?: string; error?: string }> {
  try {
    const { supabase } = await requireUser();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [playerResult, ratingsResult, attrsResult, milestonesResult, trainingAttendanceResult] =
      await Promise.all([
        supabase
          .from("players")
          .select("full_name, position, date_of_birth")
          .eq("id", playerId)
          .single(),

        supabase
          .from("player_ratings")
          .select("rating, note, created_at, fixtures(opponent, fixture_date)")
          .eq("player_id", playerId)
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("player_attributes")
          .select("pace, shooting, passing, dribbling, defending, physical")
          .eq("player_id", playerId),

        supabase
          .from("player_milestone_completions")
          .select("completed_at, development_milestone_templates(title, category)")
          .eq("player_id", playerId)
          .order("completed_at", { ascending: false })
          .limit(5),

        supabase
          .from("training_attendance")
          .select("player_id, status, created_at")
          .eq("player_id", playerId)
          .gte("created_at", thirtyDaysAgo),
      ]);

    const player = playerResult.data;
    if (!player) return { error: "Player not found." };

    const ratings = ratingsResult.data ?? [];
    const attrs = attrsResult.data ?? [];
    const milestones = milestonesResult.data ?? [];
    const trainingAttendance = trainingAttendanceResult.data ?? [];

    const age = calculateAge(player.date_of_birth);

    const avgRating =
      ratings.length > 0
        ? (ratings.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / ratings.length).toFixed(1)
        : null;

    const ratingsSummary = ratings
      .map((r: { rating: number; note: string | null; fixtures: { opponent: string; fixture_date: string } | { opponent: string; fixture_date: string }[] | null }) => {
        const fix = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
        return `${r.rating}/5 vs ${fix?.opponent ?? "training"}${r.note ? ` ("${r.note}")` : ""}`;
      })
      .join("; ");

    const attrRows = attrs as Record<string, number>[];
    const avg = (key: string) =>
      attrRows.length
        ? Math.round(attrRows.reduce((s, r) => s + (r[key] ?? 0), 0) / attrRows.length)
        : null;

    const attributeSummary =
      attrRows.length > 0
        ? `Pace ${avg("pace")}, Shooting ${avg("shooting")}, Passing ${avg("passing")}, Dribbling ${avg("dribbling")}, Defending ${avg("defending")}, Physical ${avg("physical")}`
        : "No attribute assessments yet";

    const milestonesList = milestones
      .map((m: { completed_at: string; development_milestone_templates: { title: string; category: string } | { title: string; category: string }[] | null }) => {
        const t = Array.isArray(m.development_milestone_templates)
          ? m.development_milestone_templates[0]
          : m.development_milestone_templates;
        return t ? `${t.category}: ${t.title}` : null;
      })
      .filter(Boolean)
      .join(", ");

    const attendingCount = trainingAttendance.filter(
      (a: { status: string }) => a.status === "attending"
    ).length;

    const ltpdPhase = (() => {
      if (!age) return "Training to Train (U13-U15)";
      if (age <= 9)  return "FUNdamentals — focusing on fun, confidence, and love for the game";
      if (age <= 12) return "Learning to Train — building ball skills and physical fundamentals";
      if (age <= 15) return "Training to Train — developing tactical understanding and positional awareness";
      if (age <= 18) return "Training to Compete — preparing for competitive, high-intensity football";
      return "Training to Win — elite performance and competition readiness";
    })();

    const prompt = `Write a warm, encouraging progress report for the parent of a young footballer at a SAFA-registered academy.

PLAYER DATA:
- Name: ${player.full_name}
- Position: ${player.position ?? "Not specified"}
${age ? `- Age: ${age} | Development Stage: ${ltpdPhase}` : `- Development Stage: ${ltpdPhase}`}
- Recent match ratings (last 6): ${ratingsSummary || "No recent ratings"}
- Average rating: ${avgRating ? `${avgRating}/5` : "Not available"}
- Attributes (out of 100): ${attributeSummary}
- Recent milestones achieved: ${milestonesList || "None recorded yet"}
- Training sessions attended (last 30 days): ${attendingCount}

CRITICAL RULES:
- Strictly 160-210 words total.
- Written as the coaching staff (first person plural: "we", "our").
- Refer to the player as "${player.full_name}" or "your child" — never "he/she" alone.
- Warm, encouraging, and culturally respectful tone — this is a South African youth academy.
- Frame everything positively — weaknesses are "growth areas" and "exciting opportunities".
- Acknowledge the parent's role in the player's development journey.
- Reference the player's LTPD development stage to set age-appropriate expectations.
- Plain text only — no asterisks, no Markdown, no bold formatting.
- Use dashes "-" for list items.

Use these exact section headers:
1. OVERALL PROGRESS:
2. STRENGTHS WE'VE NOTICED:
3. AREAS WE'RE WORKING ON:
4. UPCOMING FOCUS:
5. DEVELOPMENT PATHWAY NOTE: (one sentence on what stage of the SAFA/FIFA development journey ${player.full_name} is on and what lies ahead)
6. FROM THE COACHING STAFF:`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 700,
        // Disable thinking: this is a direct-answer task, and unbudgeted
        // thinking tokens were silently eating the whole visible-output budget,
        // truncating the answer before the reader ever saw it end.
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You are a SAFA-accredited youth development coach writing warm, culturally sensitive progress reports for parents of young South African footballers. Your reports apply Long-Term Player Development (LTPD) principles, mastery-climate coaching philosophy (praising effort and progress, not just outcomes), and South Africa's positive youth football development ethos. You understand that parents are key partners in a young player's journey. Plain text only — no asterisks, no Markdown.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { report: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}
