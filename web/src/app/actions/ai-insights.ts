"use server";

import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireUser } from "@/lib/auth";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function getPlayerInsights(playerId: string): Promise<{
  insights?: string;
  error?: string;
}> {
  try {
    const { supabase } = await requireUser();

    const [
      playerResult,
      ratingsResult,
      attrsResult,
      milestonesResult
    ] = await Promise.all([
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
        .limit(10),

      supabase
        .from("player_attributes")
        .select("pace, shooting, passing, dribbling, defending, physical, ball_control, crossing, heading, tackling, finishing, first_touch, stamina, agility, jumping, strength, positioning, decision_making, composure, work_rate, leadership, shot_stopping, reflexes, distribution, handling")
        .eq("player_id", playerId),

      supabase
        .from("player_milestone_completions")
        .select(
          "template_id, completed_at, development_milestone_templates(title, category)"
        )
        .eq("player_id", playerId)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);

    const player = playerResult?.data;
    const ratings = ratingsResult?.data;
    const attrs = attrsResult?.data;
    const milestones = milestonesResult?.data;

    if (!player) return { error: "Player not found." };

    const age = player.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(player.date_of_birth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
        )
      : null;

    const attrRows = attrs ?? [];

    const ALL_ATTR_KEYS = [
      "pace", "shooting", "passing", "dribbling", "defending", "physical",
      "ball_control", "crossing", "heading", "tackling", "finishing", "first_touch",
      "stamina", "agility", "jumping", "strength",
      "positioning", "decision_making", "composure", "work_rate", "leadership",
      "shot_stopping", "reflexes", "distribution", "handling",
    ];

    const ATTR_LABELS: Record<string, string> = {
      pace: "Pace", shooting: "Shooting", passing: "Passing", dribbling: "Dribbling",
      defending: "Defending", physical: "Physical", ball_control: "Ball Control",
      crossing: "Crossing", heading: "Heading", tackling: "Tackling",
      finishing: "Finishing", first_touch: "First Touch", stamina: "Stamina",
      agility: "Agility", jumping: "Jumping", strength: "Strength",
      positioning: "Positioning", decision_making: "Decision Making",
      composure: "Composure", work_rate: "Work Rate", leadership: "Leadership",
      shot_stopping: "Shot Stopping", reflexes: "Reflexes",
      distribution: "Distribution", handling: "Handling",
    };

    const avg = (key: string) => {
      if (!attrRows.length) return null;
      const vals = attrRows.map((r: any) => r[key]).filter((v: any) => v != null);
      if (!vals.length) return null;
      return Math.round(vals.reduce((sum: number, v: number) => sum + v, 0) / vals.length);
    };

    const attributeSummary = attrRows.length
      ? ALL_ATTR_KEYS
          .map((key) => {
            const val = avg(key);
            return val != null ? `${ATTR_LABELS[key]}: ${val}` : null;
          })
          .filter(Boolean)
          .join(", ")
      : "No attribute assessments yet";

    const ratingsSummary = (ratings ?? [])
      .map((r: any) => {
        const fix = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
        return `${r.rating}/5 vs ${fix?.opponent ?? "training"}${
          r.note ? ` — "${r.note}"` : ""
        }`;
      })
      .join("; ");

    const completedMilestones = (milestones ?? [])
      .map((m: any) => {
        const t = Array.isArray(m.development_milestone_templates)
          ? m.development_milestone_templates[0]
          : m.development_milestone_templates;

        return t ? `${t.category}: ${t.title}` : null;
      })
      .filter(Boolean)
      .join(", ");

    const ltpdPhase = (() => {
      if (!age) return "Training to Train (U13-U15)";
      if (age <= 9)  return "FUNdamentals (U6-U9)";
      if (age <= 12) return "Learning to Train (U10-U12)";
      if (age <= 15) return "Training to Train (U13-U15)";
      if (age <= 18) return "Training to Compete (U16-U18)";
      return "Training to Win (U19+)";
    })();

    const prompt = `Generate a concise, high-impact technical player evaluation for the coaching staff of a SAFA-registered youth academy.

CRITICAL RULES:
- Use third person exclusively ("${player.full_name}", "the player"). No second-person pronouns.
- Be specific to the data provided — do not make up attributes or ratings.
- Keep the total response strictly between 160 and 220 words.
- Plain text only — no asterisks, no Markdown, no bolding. Use dashes "-" for list items.

PLAYER PROFILE:
- Name: ${player.full_name}
- Position: ${player.position ?? "Unknown"}
- Age: ${age ?? "Unknown"} | LTPD Phase: ${ltpdPhase}

DATA CONTEXT:
- Match Ratings (Last 10): ${ratingsSummary || "None recorded"}
- Attributes (Avg/100): ${attributeSummary}
- Milestones Completed: ${completedMilestones || "None recorded"}

SAFA/FIFA EVALUATION FRAMEWORK:
- Assess against LTPD phase-appropriate expectations (not adult standards)
- Reference the 4-Corner Model: Technical, Tactical, Physical, Social/Psychological
- Consider position-specific SAFA competency requirements
- Identify readiness indicators for the next LTPD phase

Output using these exact plain text headers:
1. STRENGTHS: (1-2 dashed points — specific to data, referencing 4-Corner dimension)
2. PRIORITY DEVELOPMENT: (1-2 dashed points — phase-appropriate gaps, SAFA-aligned)
3. RECOMMENDED DRILLS: (1-2 dashed points — specific drill types to address the gaps)
4. PATHWAY READINESS: (One sentence on readiness for the next LTPD phase or development pathway step)
5. MOTIVATIONAL NOTE: (One encouraging sentence for the coaching staff)`;

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 600,
        systemInstruction: "You are a SAFA Level 4 and FIFA-certified technical director providing data-driven player evaluations. Your assessments apply the Long-Term Player Development (LTPD) framework, SAFA's position-specific competency standards, the 4-Corner development model (Technical, Tactical, Physical, Social/Psychological), and the South African football pathway from grassroots to PSL level. Plain text only — no asterisks, no Markdown.",
      }
    });

    let text = response.text;

    if (!text) {
      throw new Error("No response from Gemini");
    }

    // Failsafe: Strip out any asterisks the AI accidentally includes
    text = text.replace(/\*/g, ""); 

    return { insights: text };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI service unavailable.",
    };
  }
}
