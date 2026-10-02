import type { SupabaseClient } from "@supabase/supabase-js";
import { planningTerm } from "@/lib/term-plan";
import type { FixtureFact } from "@/lib/term-plan";

type Client = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface PlanTerm { id: string; name: string; starts_on: string; ends_on: string }

export interface TermPlanInputs {
  /** False until migration 053 (school terms) has been run. */
  available: boolean;
  term: PlanTerm | null;
  fixtures: FixtureFact[];
  /** Dates (YYYY-MM-DD, academy time) the team already has a training session on. */
  sessionDates: Set<string>;
}

const missing = (e: { code?: string } | null | undefined) => e?.code === "42P01" || e?.code === "PGRST205";

const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 2 * 3_600_000).toISOString().slice(0, 10);

/** The term to plan, the team's fixtures in it, and the days it already trains. Read-only. */
export async function loadTermPlanInputs(supabase: Client, teamId: string, academyId: string, today: string): Promise<TermPlanInputs> {
  const termsRes = await supabase.from("academy_terms").select("id, name, starts_on, ends_on").eq("academy_id", academyId);
  if (termsRes.error) return { available: !missing(termsRes.error), term: null, fixtures: [], sessionDates: new Set() };
  const term = planningTerm((termsRes.data ?? []) as PlanTerm[], today);
  if (!term) return { available: true, term: null, fixtures: [], sessionDates: new Set() };

  const from = `${term.starts_on}T00:00:00+02:00`;
  const to = `${term.ends_on}T23:59:59+02:00`;
  const [{ data: fx }, { data: ss }] = await Promise.all([
    supabase.from("fixtures").select("opponent, fixture_date, status").eq("team_id", teamId).gte("fixture_date", from).lte("fixture_date", to),
    supabase.from("training_sessions").select("session_date").eq("team_id", teamId).gte("session_date", from).lte("session_date", to),
  ]);
  const fixtures = ((fx ?? []) as { opponent: string; fixture_date: string; status: string }[])
    .filter((f) => f.status !== "cancelled")
    .map((f) => ({ date: dayOf(f.fixture_date), opponent: f.opponent }));
  const sessionDates = new Set(((ss ?? []) as { session_date: string }[]).map((s) => dayOf(s.session_date)));
  return { available: true, term, fixtures, sessionDates };
}
