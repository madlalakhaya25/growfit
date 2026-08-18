// Curated tactical concept library for the coach "Tactics" tool.
//
// Content is fixed and vetted here (no LLM-invented data) so the concept list
// and video links are always valid. The LLM only writes the age-appropriate
// explanation at request time (see app/actions/tactics.ts). Video links are
// YouTube *search* deep-links built from `searchQueries` — they can never 404
// and keep a coach inside a scoped, sensible result set. These can later be
// swapped for hand-vetted clip URLs or wired to the YouTube Data API.

export type TacticalCategory =
  | "In Possession"
  | "Out of Possession"
  | "Transition"
  | "Set Pieces";

export interface TacticalConcept {
  id: string;
  label: string;
  category: TacticalCategory;
  summary: string;
  /** Search phrases used to build YouTube result links for this concept. */
  searchQueries: string[];
}

export const TACTICAL_CATEGORIES: TacticalCategory[] = [
  "In Possession",
  "Out of Possession",
  "Transition",
  "Set Pieces",
];

export const TACTICAL_CONCEPTS: TacticalConcept[] = [
  // ── In Possession ─────────────────────────────────────────────
  {
    id: "build-from-back",
    label: "Building from the Back",
    category: "In Possession",
    summary:
      "Playing out from the goalkeeper and defenders under pressure to progress the ball with control.",
    searchQueries: [
      "building from the back youth football training drill",
      "playing out from the back tactics explained",
    ],
  },
  {
    id: "through-thirds",
    label: "Playing Through the Thirds",
    category: "In Possession",
    summary:
      "Moving the ball purposefully from defence into midfield and attack, keeping shape between the lines.",
    searchQueries: [
      "playing through the thirds football training session",
      "progressing the ball through midfield tactics",
    ],
  },
  {
    id: "positional-play",
    label: "Positional Play & Rondos",
    category: "In Possession",
    summary:
      "Keeping possession through positioning, passing angles and quick one- and two-touch play.",
    searchQueries: [
      "rondo positional play training drill youth",
      "juego de posicion positional play explained",
    ],
  },
  {
    id: "width-overloads",
    label: "Width & Overloads",
    category: "In Possession",
    summary:
      "Stretching the opponent and creating numerical advantages in wide areas to break lines.",
    searchQueries: [
      "creating overloads wide areas football drill",
      "using width to break down a defence tactics",
    ],
  },

  // ── Out of Possession ─────────────────────────────────────────
  {
    id: "high-press",
    label: "High Press",
    category: "Out of Possession",
    summary:
      "Pressing the opponent high up the pitch with coordinated triggers to win the ball early.",
    searchQueries: [
      "high press pressing triggers football training drill",
      "how to coach a high press youth football",
    ],
  },
  {
    id: "mid-low-block",
    label: "Mid & Low Block",
    category: "Out of Possession",
    summary:
      "Defending in a compact, organised shape that denies space centrally and stays hard to break down.",
    searchQueries: [
      "defensive low block compact shape training drill",
      "mid block defending tactics explained",
    ],
  },
  {
    id: "defensive-shape",
    label: "Defensive Shape & Compactness",
    category: "Out of Possession",
    summary:
      "Staying connected between the lines and shifting as a unit to protect key spaces.",
    searchQueries: [
      "defensive shape compactness football coaching drill",
      "team defending staying compact between the lines",
    ],
  },

  // ── Transition ────────────────────────────────────────────────
  {
    id: "counter-press",
    label: "Counter-Press (Winning It Back)",
    category: "Transition",
    summary:
      "Pressing immediately in the seconds after losing the ball to regain it before the opponent settles.",
    searchQueries: [
      "counter press winning the ball back training drill",
      "gegenpress transition defending explained",
    ],
  },
  {
    id: "counter-attack",
    label: "Attacking Transition (Counter-Attack)",
    category: "Transition",
    summary:
      "Exploiting space quickly and directly in the moment after winning possession.",
    searchQueries: [
      "counter attack transition football training session",
      "fast attacking transition drills youth",
    ],
  },

  // ── Set Pieces ────────────────────────────────────────────────
  {
    id: "attacking-set-pieces",
    label: "Attacking Set Pieces",
    category: "Set Pieces",
    summary:
      "Organised corner and free-kick routines that create clear chances from dead-ball situations.",
    searchQueries: [
      "attacking corner routines football training",
      "attacking set piece ideas free kicks",
    ],
  },
  {
    id: "defending-set-pieces",
    label: "Defending Set Pieces",
    category: "Set Pieces",
    summary:
      "Marking schemes and organisation to defend corners and free kicks as a unit.",
    searchQueries: [
      "defending corners marking system training drill",
      "how to defend set pieces youth football",
    ],
  },
];

export function getConcept(id: string): TacticalConcept | undefined {
  return TACTICAL_CONCEPTS.find((c) => c.id === id);
}

/** Build a guaranteed-valid YouTube search-results URL for a query. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
