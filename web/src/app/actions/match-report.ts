"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateMatchReport(
  fixtureId: string
): Promise<{ report?: string; error?: string }> {
  try {
    const { supabase } = await requireUser();

    const [fixtureResult, matchResultResult, ratingsResult, attendanceResult] =
      await Promise.all([
        supabase
          .from("fixtures")
          .select("opponent, fixture_date, is_home, venue, status")
          .eq("id", fixtureId)
          .single(),

        supabase
          .from("match_results")
          .select("team_score, opponent_score, match_notes")
          .eq("fixture_id", fixtureId)
          .maybeSingle(),

        supabase
          .from("player_ratings")
          .select("rating, note, players(full_name, position)")
          .eq("fixture_id", fixtureId),

        supabase
          .from("match_attendance")
          .select("player_id, status")
          .eq("fixture_id", fixtureId),
      ]);

    const fixture = fixtureResult.data;
    if (!fixture) return { error: "Fixture not found." };

    const result = matchResultResult.data;
    const ratings = ratingsResult.data ?? [];
    const attendance = attendanceResult.data ?? [];

    const presentCount = attendance.filter(
      (a: { player_id: string; status: string }) => a.status === "present"
    ).length;
    const absentCount = attendance.filter(
      (a: { player_id: string; status: string }) => a.status === "absent"
    ).length;

    const ratingsSummary = ratings
      .map((r: { rating: number; note: string | null; players: { full_name: string; position: string | null } | { full_name: string; position: string | null }[] | null }) => {
        const player = Array.isArray(r.players) ? r.players[0] : r.players;
        return `${player?.full_name ?? "Unknown"} (${player?.position ?? "?"}) — ${r.rating}/5${r.note ? `: "${r.note}"` : ""}`;
      })
      .join("; ");

    const scoreLine = result
      ? fixture.is_home
        ? `${result.team_score} – ${result.opponent_score} (Home)`
        : `${result.opponent_score} – ${result.team_score} (Away)`
      : "Result not recorded";

    const prompt = `Write a post-match technical report for the coaching staff of a SAFA-registered youth football academy.

MATCH DATA:
- Opponent: ${fixture.opponent}
- Date: ${fixture.fixture_date}
- Venue: ${fixture.venue ?? "Not specified"}
- Home/Away: ${fixture.is_home ? "Home" : "Away"}
- Score: ${scoreLine}
${result?.match_notes ? `- Match notes: ${result.match_notes}` : ""}
- Player ratings: ${ratingsSummary || "None recorded"}
- Attendance: ${presentCount} present, ${absentCount} absent

CRITICAL RULES:
- Strictly 160-220 words total.
- Use third person throughout ("the team", player names).
- Plain text only — no asterisks, no Markdown, no bold formatting.
- Use dashes "-" for list items.
- Apply FIFA/SAFA technical analysis standards: assess both technical execution and tactical decision-making.
- Frame feedback through a youth development lens — praise effort and learning, not just results.
- Identify specific 4-Corner improvements (Technical, Tactical, Physical, Social/Psychological).

Use these exact section headers:
1. MATCH SUMMARY:
2. STANDOUT PERFORMERS: (reference specific ratings or noted contributions)
3. COLLECTIVE DEVELOPMENT AREAS: (technical and tactical patterns the team should work on)
4. TRAINING FOCUS THIS WEEK: (2-3 specific drill or session themes aligned to the match observations)
5. DEVELOPMENT ALIGNMENT: (one sentence on how today's performance reflects age-appropriate SAFA/FIFA development targets for this squad)`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 700,
        systemInstruction:
          "You are a SAFA/CAF-licensed technical analyst writing post-match reports for youth academy coaches. Your analysis applies FIFA technical study group methodology, age-appropriate development principles, the 4-Corner Player Development Model, and SAFA's tactical framework for youth football. You assess both individual and collective performance through a long-term development lens, not just match outcomes. Plain text only — no asterisks, no Markdown.",
      },
    });

    let text = response.text ?? "";
    text = text.replace(/\*/g, "");

    return { report: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI service unavailable." };
  }
}
