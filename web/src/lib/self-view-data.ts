import type { SupabaseClient } from "@supabase/supabase-js";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";
import { BAND_LABELS } from "@/lib/term-review";
import { gapBetween, SELF_RATING_LABELS } from "@/lib/self-assessment";
import { loadSelfRatings, loadTermReview } from "@/lib/term-review-data";
import { todayIso } from "@/lib/time";
import type { BriefInput } from "@/lib/development-brief";

/**
 * Where a child's own rating and the coach's band this term differ by a whole
 * band, for the development plan's brief. Anything missing (no terms set up,
 * no review yet, migrations 053-055 not applied, a failed read) is simply no
 * gap: the plan is made as before, never blocked by this.
 */
export async function loadSelfView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  playerId: string,
  academyId: string,
  now: Date
): Promise<NonNullable<BriefInput["selfView"]>> {
  try {
    const review = await loadTermReview(supabase, playerId, academyId, todayIso(now));
    if (!review.available || !review.term) return [];
    const self = await loadSelfRatings(supabase, playerId, review.term.id);
    return MILESTONE_CATEGORIES.flatMap((category) => {
      const rating = self[category];
      const band = review.current[category];
      if (!rating || !band || gapBetween(rating, band) === "match") return [];
      return [{ category, feels: SELF_RATING_LABELS[rating].toLowerCase(), coachSees: BAND_LABELS[band] }];
    });
  } catch {
    return [];
  }
}
