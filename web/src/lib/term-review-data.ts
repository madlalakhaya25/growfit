import type { SupabaseClient } from "@supabase/supabase-js";
import { currentTerm, previousTerm } from "@/lib/school-terms";
import { isBand, type Band } from "@/lib/term-review";
import { MILESTONE_CATEGORIES, type MilestoneCategory } from "@/lib/development-categories";
import { isSelfRating, type SelfRating } from "@/lib/self-assessment";

export interface ReviewTerm {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export type BandMap = Partial<Record<MilestoneCategory, Band>>;

export interface TermReviewSnapshot {
  /** False until migrations 053 and 054 are applied: the screen then shows nothing, not an error. */
  available: boolean;
  term: ReviewTerm | null;
  previous: ReviewTerm | null;
  current: BandMap;
  last: BandMap;
}

const EMPTY: TermReviewSnapshot = { available: false, term: null, previous: null, current: {}, last: {} };

/** `42P01` / `PGRST205`: the table is not there yet. See web/CLAUDE.md "A missing TABLE...". */
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function toBandMap(rows: { term_id: string; category: string; band: number }[], termId: string | undefined): BandMap {
  const out: BandMap = {};
  if (!termId) return out;
  for (const r of rows) {
    if (r.term_id !== termId) continue;
    if ((MILESTONE_CATEGORIES as readonly string[]).includes(r.category) && isBand(r.band)) {
      out[r.category as MilestoneCategory] = r.band;
    }
  }
  return out;
}

/** This term's and last term's bands for one player. */
export async function loadTermReview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string,
  academyId: string,
  today: string
): Promise<TermReviewSnapshot> {
  const termsRes = await supabase
    .from("academy_terms")
    .select("id, name, starts_on, ends_on")
    .eq("academy_id", academyId);
  if (termsRes.error) {
    if (isMissingTable(termsRes.error)) return EMPTY;
    return { ...EMPTY, available: true };
  }
  const terms = (termsRes.data ?? []) as ReviewTerm[];
  const term = currentTerm(terms, today);
  if (!term) return { ...EMPTY, available: true };
  const previous = previousTerm(terms, term);

  const ids = [term.id, previous?.id].filter((x): x is string => Boolean(x));
  const reviewsRes = await supabase
    .from("player_term_reviews")
    .select("term_id, category, band")
    .eq("player_id", playerId)
    .in("term_id", ids);
  if (reviewsRes.error) {
    if (isMissingTable(reviewsRes.error)) return EMPTY;
    return { ...EMPTY, available: true, term, previous };
  }
  const rows = (reviewsRes.data ?? []) as { term_id: string; category: string; band: number }[];
  return {
    available: true,
    term,
    previous,
    current: toBandMap(rows, term.id),
    last: toBandMap(rows, previous?.id),
  };
}

export interface SquadReviewPlayer {
  id: string;
  name: string;
  current: BandMap;
  last: BandMap;
  self: SelfRatingMap;
}

export interface SquadReviewSnapshot {
  available: boolean;
  term: ReviewTerm | null;
  previous: ReviewTerm | null;
  players: SquadReviewPlayer[];
}

/** Every active player on a team, with this term's and last term's bands. One query for all the reviews. */
export async function loadSquadReview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  teamId: string,
  academyId: string,
  today: string
): Promise<SquadReviewSnapshot> {
  const empty: SquadReviewSnapshot = { available: false, term: null, previous: null, players: [] };

  const termsRes = await supabase
    .from("academy_terms")
    .select("id, name, starts_on, ends_on")
    .eq("academy_id", academyId);
  if (termsRes.error) return isMissingTable(termsRes.error) ? empty : { ...empty, available: true };
  const terms = (termsRes.data ?? []) as ReviewTerm[];
  const term = currentTerm(terms, today);
  if (!term) return { ...empty, available: true };
  const previous = previousTerm(terms, term);

  const membersRes = await supabase
    .from("team_members")
    .select("players ( id, full_name )")
    .eq("team_id", teamId)
    .eq("active", true);
  type Person = { id: string; full_name: string };
  const roster = ((membersRes.data ?? []) as unknown as { players: Person | Person[] | null }[])
    .flatMap((m) => [m.players ?? []].flat())
    .sort((a, b) => a.full_name.localeCompare(b.full_name) || a.id.localeCompare(b.id));

  const ids = [term.id, previous?.id].filter((x): x is string => Boolean(x));
  const reviewsRes = roster.length
    ? await supabase
        .from("player_term_reviews")
        .select("player_id, term_id, category, band")
        .in("player_id", roster.map((p) => p.id))
        .in("term_id", ids)
    : { data: [], error: null };
  if (reviewsRes.error) {
    return isMissingTable(reviewsRes.error) ? empty : { available: true, term, previous, players: [] };
  }
  const rows = (reviewsRes.data ?? []) as { player_id: string; term_id: string; category: string; band: number }[];

  // Their own answers, for the coach's conversation. Absent until migration 055: no error.
  const selfRes = roster.length
    ? await supabase
        .from("player_self_assessments")
        .select("player_id, category, rating")
        .in("player_id", roster.map((p) => p.id))
        .eq("term_id", term.id)
    : { data: [], error: null };
  const selfRows = selfRes.error ? [] : ((selfRes.data ?? []) as { player_id: string; category: string; rating: number }[]);

  return {
    available: true,
    term,
    previous,
    players: roster.map((p) => {
      const mine = rows.filter((r) => r.player_id === p.id);
      return {
        id: p.id,
        name: p.full_name,
        current: toBandMap(mine, term.id),
        last: toBandMap(mine, previous?.id),
        self: toSelfMap(selfRows.filter((r) => r.player_id === p.id)),
      };
    }),
  };
}

export type SelfRatingMap = Partial<Record<MilestoneCategory, SelfRating>>;

function toSelfMap(rows: { category: string; rating: number }[]): SelfRatingMap {
  const out: SelfRatingMap = {};
  for (const r of rows) {
    if ((MILESTONE_CATEGORIES as readonly string[]).includes(r.category) && isSelfRating(r.rating)) {
      out[r.category as MilestoneCategory] = r.rating;
    }
  }
  return out;
}

/** A player's own ratings for one term. Empty (not an error) until migration 055 is run. */
export async function loadSelfRatings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string,
  termId: string
): Promise<SelfRatingMap> {
  const { data, error } = await supabase
    .from("player_self_assessments")
    .select("category, rating")
    .eq("player_id", playerId)
    .eq("term_id", termId);
  if (error) return {};
  return toSelfMap((data ?? []) as { category: string; rating: number }[]);
}
