import { asRecord, boundedInt } from "./shared";
import type { AgentTool } from "./types";
import {
  DRILL_CATEGORIES,
  drillCategoryForCorner,
  drillCategoryFromSessionKind,
  isDrillCategory,
  type DrillCategory,
} from "@/lib/drill-taxonomy";
import { MILESTONE_CATEGORIES, type MilestoneCategory } from "@/lib/development-categories";

interface Input { query?: string; category?: DrillCategory; corner?: MilestoneCategory; limit: number }
interface Row {
  drillId: string; name: string; category: string; durationMinutes: number | null;
  difficulty: string | null; description: string | null;
}
type Output = { drills: Row[]; note?: string };

/** Strip characters that are syntax in a PostgREST `or`/`ilike` filter. */
export function sanitiseDrillQuery(q: string): string {
  return q.replace(/[%_,()*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export const searchDrills: AgentTool<Input, Output> = {
  name: "searchDrills",
  description: "Searches the academy's drill library by keyword, category or development corner.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Keyword to match in the drill name or description." },
      category: { type: "string", enum: [...DRILL_CATEGORIES, "fitness"], description: "Library category. \"fitness\" is accepted and means physical." },
      developmentCorner: {
        type: "string",
        enum: [...MILESTONE_CATEGORIES],
        description: "Find drills for a development corner. Only technical, tactical and physical have drills of their own.",
      },
      limit: { type: "integer", description: "Max drills, 1 to 20. Defaults to 10." },
    },
  },
  maxRows: 20,
  parseInput(raw) {
    const r = asRecord(raw ?? {});
    if (!r) return null;
    if (r.query != null && typeof r.query !== "string") return null;
    if (r.category != null && r.developmentCorner != null) return null;
    // The model may use the session page's word for conditioning; map it at
    // this boundary (see lib/drill-taxonomy.ts) rather than widening the enum.
    const category =
      r.category == null ? undefined : (isDrillCategory(r.category) ? r.category : drillCategoryFromSessionKind(String(r.category)));
    if (r.category != null && !category) return null;
    if (r.developmentCorner != null && !(MILESTONE_CATEGORIES as readonly unknown[]).includes(r.developmentCorner)) return null;
    const limit = boundedInt(r.limit, { min: 1, max: 20, fallback: 10 });
    if (limit === undefined) return null;
    const query = typeof r.query === "string" ? sanitiseDrillQuery(r.query) : undefined;
    return {
      query: query || undefined,
      category: category ?? undefined,
      corner: (r.developmentCorner as MilestoneCategory | undefined) ?? undefined,
      limit,
    };
  },
  async run(ctx, input) {
    // The library is per-academy; RLS enforces it too, but never query
    // academy-less on RLS alone.
    if (!ctx.academyId) return { drills: [] };

    // A corner becomes a category here. mental / leadership have none: say so
    // and let the model search by keyword, instead of guessing a category.
    let category = input.category;
    if (input.corner) {
      const mapped = drillCategoryForCorner(input.corner);
      if (!mapped) {
        return {
          drills: [],
          note: `There is no drill category for ${input.corner}; it is developed within every kind of session. Search by keyword instead.`,
        };
      }
      category = mapped;
    }

    let q = ctx.supabase
      .from("drill_library")
      .select("id, name, description, category, duration_minutes, difficulty")
      .eq("academy_id", ctx.academyId);
    if (category) q = q.eq("category", category);
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
  links: (o) => (o.drills.length ? [{ label: "Drill library", href: "/dashboard/coach/training/drills", match: o.drills.map((d) => d.name) }] : []),
};
