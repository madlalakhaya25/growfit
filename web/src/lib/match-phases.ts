// How the team did in each phase of play, rated 1 to 5 by the coach after a
// match (borrowed from Finalthird's "evaluate team performance by phase of
// play"). The four moments of the game, as SAFA and UEFA coaching courses
// teach them, plus set pieces, which decide so many grassroots matches.
// A judgement of the team, never of a child. Pure.

export const MATCH_PHASES = [
  { id: "in_possession", label: "In possession", hint: "Building up and creating chances" },
  { id: "out_of_possession", label: "Out of possession", hint: "Shape, pressing and protecting the goal" },
  { id: "attacking_transition", label: "Winning the ball", hint: "The first seconds after we win it" },
  { id: "defensive_transition", label: "Losing the ball", hint: "The first seconds after we lose it" },
  { id: "set_pieces", label: "Set pieces", hint: "Corners, free kicks and throw-ins, both ends" },
] as const;

export type MatchPhaseId = (typeof MATCH_PHASES)[number]["id"];
export type PhaseRatings = Partial<Record<MatchPhaseId, number>>;

const IDS = new Set<string>(MATCH_PHASES.map((p) => p.id));

/**
 * The ratings worth keeping from anything stored or sent: known phases only,
 * whole numbers 1 to 5 only. Returns null when nothing is left, so an
 * untouched row stores nothing rather than an empty object.
 */
export function cleanPhaseRatings(raw: unknown): PhaseRatings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: PhaseRatings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (IDS.has(key) && typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) {
      out[key as MatchPhaseId] = value;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** The rated phases in the fixed order above, for display. */
export function ratedPhases(ratings: PhaseRatings | null): { id: MatchPhaseId; label: string; rating: number }[] {
  if (!ratings) return [];
  return MATCH_PHASES.flatMap((p) => (ratings[p.id] ? [{ id: p.id, label: p.label, rating: ratings[p.id]! }] : []));
}

/** The strongest and weakest rated phases, or null when fewer than two phases differ. */
export function phaseHighlights(ratings: PhaseRatings | null): { best: string; worst: string } | null {
  const rated = ratedPhases(ratings);
  if (rated.length < 2) return null;
  const best = rated.reduce((a, b) => (b.rating > a.rating ? b : a), rated[0]);
  const worst = rated.reduce((a, b) => (b.rating < a.rating ? b : a), rated[0]);
  if (best.rating === worst.rating) return null;
  return { best: best.label, worst: worst.label };
}
