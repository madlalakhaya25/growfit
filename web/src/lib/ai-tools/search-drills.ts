import { asRecord, boundedInt } from "./shared";
import type { AgentTool } from "./types";

// drill_library's own six categories (migration 012). NOT the three on
// training_drills (`fitness` != `physical`) and NOT the five development
// corners in lib/development-categories.ts — three taxonomies, kept apart on
// purpose; map explicitly at each boundary rather than sharing an enum.
export const DRILL_CATEGORIES = ["warm_up", "technical", "tactical", "physical", "small_sided", "cool_down"] as const;
type DrillCategory = (typeof DRILL_CATEGORIES)[number];

interface Input { query?: string; category?: DrillCategory; limit: number }
interface Row {
  drillId: string; name: string; category: string; durationMinutes: number | null;
  difficulty: string | null; description: string | null;
}
type Output = { drills: Row[] };

/** Strip characters that are syntax in a PostgREST `or`/`ilike` filter. */
export function sanitiseDrillQuery(q: string): string {
  return q.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export const searchDrills: AgentTool<Input, Output> = {
  name: "searchDrills",
  description: "Searches the academy's drill library by keyword and/or category.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword to match in the drill name or description." },
      category: { type: "string", enum: [...DRILL_CATEGORIES] },
      limit: { type: "integer", description: "Max drills, 1 to 20. Defaults to 10." },
    },
  },
  maxRows: 20,
  parseInput(raw) {
    const r = asRecord(raw ?? {});
    if (!r) return null;
    if (r.query != null && typeof r.query !== "string") return null;
    if (r.category != null && !(DRILL_CATEGORIES as readonly string[]).includes(r.category as string)) return null;
    const limit = boundedInt(r.limit, { min: 1, max: 20, fallback: 10 });
    if (limit === undefined) return null;
    const query = typeof r.query === "string" ? sanitiseDrillQuery(r.query) : undefined;
    return { query: query || undefined, category: (r.category as DrillCategory | undefined) ?? undefined, limit };
  },
  async run(ctx, input) {
    // The library is per-academy; RLS enforces it too, but never query
    // academy-less on RLS alone.
    if (!ctx.academyId) return { drills: [] };
    let q = ctx.supabase
      .from("drill_library")
      .select("id, name, description, category, duration_minutes, difficulty")
      .eq("academy_id", ctx.academyId);
    if (input.category) q = q.eq("category", input.category);
    if (input.query) q = q.or(`name.ilike.%${input.query}%,description.ilike.%${input.query}%`);
    const { data, error } = await q.order("name", { ascending: true }).limit(Math.min(input.limit, searchDrills.maxRows));
    if (error) throw error;
    return {
      drills: ((data ?? []) as {
        id: string; name: string; description: string | null; category: string;
        duration_minutes: number | null; difficulty: string | null;
      }[]).map((d) => ({
        drillId: d.id,
        name: d.name,
        category: d.category,
        durationMinutes: d.duration_minutes,
        difficulty: d.difficulty,
        description: d.description,
      })),
    };
  },
  links: (o) => (o.drills.length ? [{ label: "Drill library", href: "/dashboard/coach/training/drills" }] : []),
};
