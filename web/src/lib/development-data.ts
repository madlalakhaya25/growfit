import type { SupabaseClient } from "@supabase/supabase-js";
import { currentSeason, type MilestoneCategory } from "@/lib/development-categories";
import { reportError } from "@/lib/report-error";

/**
 * One read path for a player's milestone pathway, shared by the coach, player
 * and parent surfaces. Those pages each did their own queries and each dropped
 * the `error`, so a failed load rendered as "no milestones yet" -- BACKLOG.md
 * 4.1's lesson, repeated in a second place. This reports a failure as a
 * failure.
 *
 * Also the first reader of `player_milestone_completions.completed_at`,
 * `completed_by` and `season`, which migration 012 has stored from the start
 * and nothing ever read: the history of what a player achieved and when.
 */

export interface MilestoneTemplate {
  id: string;
  title: string;
  description: string | null;
  category: MilestoneCategory;
  position: string | null;
  age_group: string | null;
  sort_order: number;
}

export interface MilestoneCompletion {
  templateId: string;
  season: string;
  /** Nullable in the schema (`DEFAULT now()`, not `NOT NULL`). */
  completedAt: string | null;
  note: string | null;
  /**
   * Null on a player/parent surface: `profiles` RLS lets them read only their
   * own row, so a join to resolve the coach's name returns null there --
   * SILENTLY, which reads as "nobody did this". Render "your coach", never an
   * empty string. Resolved only when `resolveCompletedBy` is set (coach/admin).
   */
  completedByName: string | null;
}

export interface SeasonProgress {
  season: string;
  /** Newest first. */
  completions: MilestoneCompletion[];
}

export interface DevelopmentSnapshot {
  templates: MilestoneTemplate[];
  currentSeason: string;
  /** Template ids completed in the CURRENT season. */
  completedThisSeason: ReadonlySet<string>;
  /** The coach's note on each current-season completion, by template id. */
  currentNotes: Record<string, string | null>;
  /** Newest season first. Always includes the current season, even if empty. */
  seasons: SeasonProgress[];
  /**
   * Non-null means a query failed (or the academy link is missing). Show it
   * with a RetryButton -- never let it render as "no milestones yet".
   */
  loadError: string | null;
}

type CompletionRow = {
  template_id: string;
  season: string;
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
};

const byNewest = (a: MilestoneCompletion, b: MilestoneCompletion) => {
  // A missing timestamp sorts last; ties break on template id so the order is
  // stable however the rows arrived.
  const ta = a.completedAt ? Date.parse(a.completedAt) : Number.NEGATIVE_INFINITY;
  const tb = b.completedAt ? Date.parse(b.completedAt) : Number.NEGATIVE_INFINITY;
  if (ta !== tb) return tb - ta;
  return a.templateId.localeCompare(b.templateId);
};

/**
 * Group completions by season, newest season first and newest completion
 * first inside each. Pure. `now` only decides which season counts as current,
 * which is always present in the result so "nothing yet this season" has a
 * place to render.
 */
export function groupCompletionsBySeason(
  completions: readonly MilestoneCompletion[],
  now: Date = new Date()
): SeasonProgress[] {
  const bySeason = new Map<string, MilestoneCompletion[]>();
  bySeason.set(currentSeason(now), []);
  for (const c of completions) {
    const list = bySeason.get(c.season) ?? [];
    list.push(c);
    bySeason.set(c.season, list);
  }
  return [...bySeason.entries()]
    .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
    .map(([season, list]) => ({ season, completions: [...list].sort(byNewest) }));
}

/** Pure assembly, split out of the loader so it can be tested without a database. */
export function buildDevelopmentSnapshot(input: {
  templates: MilestoneTemplate[];
  completions: MilestoneCompletion[];
  loadError?: string | null;
  now?: Date;
}): DevelopmentSnapshot {
  const now = input.now ?? new Date();
  const season = currentSeason(now);
  const seasons = groupCompletionsBySeason(input.completions, now);
  const current = seasons.find((s) => s.season === season)?.completions ?? [];
  return {
    templates: input.templates,
    currentSeason: season,
    completedThisSeason: new Set(current.map((c) => c.templateId)),
    currentNotes: Object.fromEntries(current.map((c) => [c.templateId, c.note])),
    seasons,
    loadError: input.loadError ?? null,
  };
}

/**
 * The milestones that apply to this player's age group. A template with no
 * age group applies to everyone. `age_group` was stored from migration 012 but
 * never filtered on, so an U11 was shown -- and planned against -- U15
 * milestones. Kept regardless: anything the player has already completed, so a
 * child who moved up an age group keeps their history. With no known age group
 * (no active team, or a team with none set) nothing is hidden. Pure.
 */
export function templatesForAgeGroups(
  templates: MilestoneTemplate[],
  ageGroups: string[],
  completedTemplateIds: ReadonlySet<string>
): MilestoneTemplate[] {
  if (!ageGroups.length) return templates;
  const wanted = new Set(ageGroups.map((g) => g.trim().toUpperCase()));
  return templates.filter(
    (t) => !t.age_group || wanted.has(t.age_group.trim().toUpperCase()) || completedTemplateIds.has(t.id)
  );
}

export const MILESTONES_LOAD_ERROR = "Couldn't load development milestones.";
export const MILESTONES_NO_ACADEMY =
  "Milestones can't be shown yet -- this account isn't linked to an academy.";

export async function loadDevelopmentSnapshot(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    playerId: string;
    academyId: string | null;
    position: string | null;
    /** Coach/admin only -- resolves completed_by to a name. */
    resolveCompletedBy?: boolean;
    now?: Date;
  }
): Promise<DevelopmentSnapshot> {
  const now = input.now ?? new Date();

  // A parent who is linked but was never verified has no academy_id on their
  // profile. That is not "this child has no milestones" -- say so, rather than
  // letting the empty result read as the truth.
  if (!input.academyId) {
    return buildDevelopmentSnapshot({ templates: [], completions: [], loadError: MILESTONES_NO_ACADEMY, now });
  }

  const [templatesResult, completionsResult, teamsResult] = await Promise.all([
    supabase
      .from("development_milestone_templates")
      .select("id, title, description, category, position, age_group, sort_order")
      .eq("academy_id", input.academyId)
      .or(`position.is.null,position.eq.${input.position ?? ""}`)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("player_milestone_completions")
      .select("template_id, season, completed_at, completed_by, note")
      .eq("player_id", input.playerId)
      .order("completed_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("teams ( age_group )")
      .eq("player_id", input.playerId)
      .eq("active", true),
  ]);

  if (templatesResult.error || completionsResult.error) {
    reportError(templatesResult.error ?? completionsResult.error, {
      scope: "loadDevelopmentSnapshot",
      extra: { query: templatesResult.error ? "development_milestone_templates" : "player_milestone_completions" },
    });
    return buildDevelopmentSnapshot({ templates: [], completions: [], loadError: MILESTONES_LOAD_ERROR, now });
  }

  const rows = (completionsResult.data ?? []) as CompletionRow[];

  // Narrowing only: if the teams can't be read, show every milestone rather
  // than fail the load -- too many is a nuisance, an empty pathway is wrong.
  if (teamsResult.error) {
    reportError(teamsResult.error, { scope: "loadDevelopmentSnapshot", severity: "warning", extra: { query: "team_members" } });
  }
  type TeamRow = { teams: { age_group: string | null } | { age_group: string | null }[] | null };
  const ageGroups = ((teamsResult.data ?? []) as TeamRow[])
    .flatMap((m) => (Array.isArray(m.teams) ? m.teams : m.teams ? [m.teams] : []))
    .map((t) => t.age_group)
    .filter((g): g is string => !!g && !!g.trim());

  // Cosmetic, so a failure here is reported but does not fail the load: the
  // rows render with "your coach" instead of a name.
  const names = new Map<string, string>();
  if (input.resolveCompletedBy) {
    const ids = [...new Set(rows.map((r) => r.completed_by).filter((id): id is string => !!id))];
    if (ids.length) {
      const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (error) reportError(error, { scope: "loadDevelopmentSnapshot", severity: "warning", extra: { query: "profiles" } });
      for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
        if (p.full_name) names.set(p.id, p.full_name);
      }
    }
  }

  return buildDevelopmentSnapshot({
    templates: templatesForAgeGroups(
      (templatesResult.data ?? []) as MilestoneTemplate[],
      ageGroups,
      new Set(rows.map((r) => r.template_id))
    ),
    completions: rows.map((r) => ({
      templateId: r.template_id,
      season: r.season,
      completedAt: r.completed_at,
      note: r.note,
      completedByName: r.completed_by ? names.get(r.completed_by) ?? null : null,
    })),
    now,
  });
}
