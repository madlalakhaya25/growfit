"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateAcademyHealthReport(): Promise<{
  report?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireUser();

    // Fetch academy_id from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("academy_id")
      .eq("id", user.id)
      .single();

    if (!profile?.academy_id) return { error: "Academy not found." };
    const academyId = profile.academy_id;

    const currentYear = new Date().getFullYear().toString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // Fetch active players
    const { data: activePlayers } = await supabase
      .from("players")
      .select("id, position")
      .eq("academy_id", academyId)
      .eq("active", true);

    const activePlayerList = activePlayers ?? [];
    const totalActivePlayers = activePlayerList.length;
    const activePlayerIds = activePlayerList.map((p: { id: string }) => p.id);

    // Players by position
    const positionCounts: Record<string, number> = {};
    for (const p of activePlayerList as { id: string; position: string | null }[]) {
      const pos = p.position ?? "Unknown";
      positionCounts[pos] = (positionCounts[pos] ?? 0) + 1;
    }

    // Document compliance: signed or uploaded docs this season
    const { data: docsRaw } = await supabase
      .from("player_documents")
      .select("player_id, status")
      .eq("season", currentYear)
      .in("status", ["signed", "uploaded"])
      .in("player_id", activePlayerIds.length ? activePlayerIds : [""]);

    const signedDocCount = (docsRaw ?? []).length;
    const totalExpectedDocs = totalActivePlayers * 6;
    const compliancePct =
      totalExpectedDocs > 0
        ? Math.round((signedDocCount / totalExpectedDocs) * 100)
        : 0;

    // Average player rating last 30 days via player_ids
    const { data: recentRatings } = await supabase
      .from("player_ratings")
      .select("rating, player_id")
      .in("player_id", activePlayerIds.length ? activePlayerIds : [""])
      .gte("created_at", thirtyDaysAgo);

    const recentRatingList = recentRatings ?? [];
    const avgRating =
      recentRatingList.length > 0
        ? (
            recentRatingList.reduce(
              (sum: number, r: { rating: number }) => sum + r.rating,
              0
            ) / recentRatingList.length
          ).toFixed(2)
        : "N/A";

    // Training sessions this month — via teams.academy_id
    const { data: sessionsRaw } = await supabase
      .from("training_sessions")
      .select("id, team_id, teams ( academy_id )")
      .gte("session_date", monthStart);

    const trainingSessionsThisMonth = (sessionsRaw ?? []).filter(
      (s: { teams: { academy_id: string } | { academy_id: string }[] | null }) => {
        const t = Array.isArray(s.teams) ? s.teams[0] : s.teams;
        return t?.academy_id === academyId;
      }
    ).length;

    // Milestones completed this season via player_ids
    const { data: milestonesRaw } = await supabase
      .from("player_milestone_completions")
      .select("id")
      .in("player_id", activePlayerIds.length ? activePlayerIds : [""])
      .eq("season", currentYear);

    const milestonesCompleted = (milestonesRaw ?? []).length;

    // Top 3 rated players last 30 days
    const { data: topRatingsRaw } = await supabase
      .from("player_ratings")
      .select("player_id, rating, players ( full_name )")
      .in("player_id", activePlayerIds.length ? activePlayerIds : [""])
      .gte("created_at", thirtyDaysAgo);

    type TopRow = {
      player_id: string;
      rating: number;
      players: { full_name: string } | { full_name: string }[] | null;
    };
    const playerRatingMap = new Map<string, { name: string; ratings: number[] }>();
    for (const row of (topRatingsRaw as TopRow[] ?? [])) {
      const p = Array.isArray(row.players) ? row.players[0] : row.players;
      if (!p) continue;
      const cur = playerRatingMap.get(row.player_id) ?? { name: p.full_name, ratings: [] };
      cur.ratings.push(row.rating);
      playerRatingMap.set(row.player_id, cur);
    }
    const top3 = Array.from(playerRatingMap.values())
      .map(({ name, ratings }) => ({
        name,
        avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    // Players with no recent rating in last 30 days
    const ratedPlayerIds = new Set(
      recentRatingList.map((r: { player_id: string }) => r.player_id)
    );
    const noRecentRatingCount = activePlayerIds.filter(
      (id: string) => !ratedPlayerIds.has(id)
    ).length;

    // Build position summary string
    const positionSummary =
      Object.entries(positionCounts)
        .map(([pos, count]) => `${pos}: ${count}`)
        .join(", ") || "No data";

    // Build top performers string
    const topPerformersStr =
      top3.length > 0
        ? top3.map(({ name, avg }) => `${name} (${avg.toFixed(2)})`).join(", ")
        : "None recorded";

    const prompt = `Analyse the following data for a SAFA-registered youth football academy and produce a strategic monthly health report benchmarked against FIFA and SAFA development standards.

ACADEMY METRICS:
- Total active players: ${totalActivePlayers}
- Position breakdown: ${positionSummary}
- Document compliance: ${compliancePct}% (${signedDocCount} of ${totalExpectedDocs} documents complete)
- Average player rating this month: ${avgRating}/5
- Training sessions this month: ${trainingSessionsThisMonth}
- Milestones completed this season: ${milestonesCompleted}
- Top performers: ${topPerformersStr}
- Players needing attention (no recent rating): ${noRecentRatingCount}

SAFA / FIFA BENCHMARKS FOR CONTEXT:
- SAFA NDP standard: minimum 3 training sessions per team per week (12+ per month)
- SAFA registration: 80%+ document compliance required before competitive play
- FIFA grassroots standard: max 1:15 coach-to-player ratio; player welfare first
- Healthy monthly rating pool: 70%+ of active players should receive at least one rating
- Milestone completion: 20%+ of available milestones per season phase indicates active development
- Squad balance: SAFA recommends all outfield positions represented to enable positional rotation

Output format (plain text, no markdown, no asterisks):
1. ACADEMY OVERVIEW: (2 sentences on current academy health, referencing key metrics)
2. STRENGTHS: (2 specific positives backed by the data, referencing SAFA/FIFA benchmarks where applicable)
3. CONCERNS: (2 areas needing attention, with data-referenced reasons)
4. PRIORITY ACTIONS: (3 specific, actionable steps for coaching staff this month)
5. DIRECTOR'S NOTE: (one forward-looking sentence on the academy's development trajectory)
6. SAFA PATHWAY ALIGNMENT: (one sentence on how current performance aligns with SAFA's National Development Programme and pathway from grassroots to semi-professional football)`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 800,
        systemInstruction:
          "You are a SAFA-accredited academy director with FIFA Quality Programme and CAF Club Licensing expertise. Your monthly health reports benchmark against SAFA's National Development Programme standards, FIFA grassroots best practices, and South African youth football development criteria. Be specific, data-driven, and practical. Plain text only — no asterisks, no Markdown.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { report: text };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI service unavailable.",
    };
  }
}
