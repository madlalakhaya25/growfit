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
  | "Attacking Patterns"
  | "Game Management"
  | "Set Pieces";

export interface TacticalConcept {
  id: string;
  label: string;
  category: TacticalCategory;
  summary: string;
  /** Position groups this concept matters most to (matches POSITIONS.group). */
  relevantTo: string[];
  /** Search phrases used to build YouTube result links for this concept. */
  searchQueries: string[];
}

export const TACTICAL_CATEGORIES: TacticalCategory[] = [
  "In Possession",
  "Out of Possession",
  "Transition",
  "Attacking Patterns",
  "Game Management",
  "Set Pieces",
];

/** Position groups used across the tactics tools (matches POSITIONS.group). */
export const POSITION_GROUPS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;

export const TACTICAL_CONCEPTS: TacticalConcept[] = [
  // ── In Possession ─────────────────────────────────────────────
  {
    id: "build-from-back",
    label: "Building from the Back",
    category: "In Possession",
    summary:
      "Playing out from the goalkeeper and defenders under pressure to progress the ball with control.",
    relevantTo: ["Goalkeeper", "Defender", "Midfielder"],
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
    relevantTo: ["Defender", "Midfielder", "Forward"],
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
    relevantTo: ["Defender", "Midfielder", "Forward"],
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
    relevantTo: ["Defender", "Midfielder", "Forward"],
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
    relevantTo: ["Midfielder", "Forward"],
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
    relevantTo: ["Defender", "Midfielder"],
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
    relevantTo: ["Goalkeeper", "Defender", "Midfielder"],
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
    relevantTo: ["Midfielder", "Forward"],
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
    relevantTo: ["Midfielder", "Forward"],
    searchQueries: [
      "counter attack transition football training session",
      "fast attacking transition drills youth",
    ],
  },

  // ── Attacking Patterns ────────────────────────────────────────
  {
    id: "final-third-entries",
    label: "Final Third Entries",
    category: "Attacking Patterns",
    summary:
      "Getting the ball into dangerous areas through combinations, cutbacks and third-man runs.",
    relevantTo: ["Midfielder", "Forward"],
    searchQueries: [
      "final third entries football training drill",
      "third man run combination play attacking",
    ],
  },
  {
    id: "crossing-finishing",
    label: "Crossing & Finishing",
    category: "Attacking Patterns",
    summary:
      "Delivering from wide areas and attacking the box with the right timing and runs.",
    relevantTo: ["Midfielder", "Forward"],
    searchQueries: [
      "crossing and finishing football training session",
      "attacking the box runs near post far post",
    ],
  },
  {
    id: "breaking-low-block",
    label: "Breaking Down a Low Block",
    category: "Attacking Patterns",
    summary:
      "Patiently moving a deep, compact defence to create an opening — switches, disguise and movement.",
    relevantTo: ["Defender", "Midfielder", "Forward"],
    searchQueries: [
      "how to break down a low block football tactics",
      "breaking down deep defence training drill",
    ],
  },
  {
    id: "switching-play",
    label: "Switching Play",
    category: "Attacking Patterns",
    summary:
      "Changing the point of attack quickly to exploit space on the opposite side.",
    relevantTo: ["Defender", "Midfielder"],
    searchQueries: [
      "switching play football training drill",
      "changing the point of attack tactics explained",
    ],
  },

  // ── Game Management ───────────────────────────────────────────
  {
    id: "game-state",
    label: "Managing the Game State",
    category: "Game Management",
    summary:
      "Adapting how the team plays when leading, drawing or chasing a result late in a match.",
    relevantTo: ["Goalkeeper", "Defender", "Midfielder", "Forward"],
    searchQueries: [
      "game management football coaching leading protecting a lead",
      "how to see out a game football tactics",
    ],
  },
  {
    id: "restarts-goalkeeper",
    label: "Restarts & Goalkeeper Distribution",
    category: "Game Management",
    summary:
      "Using goal kicks, throw-ins and keeper distribution as deliberate ways to start attacks.",
    relevantTo: ["Goalkeeper", "Defender", "Midfielder"],
    searchQueries: [
      "goalkeeper distribution goal kick options training",
      "throw in routines football coaching drill",
    ],
  },
  {
    id: "tempo-control",
    label: "Tempo & Rest Defence",
    category: "Game Management",
    summary:
      "Controlling the speed of the game and staying protected against the counter while attacking.",
    relevantTo: ["Defender", "Midfielder"],
    searchQueries: [
      "rest defence football tactics explained",
      "controlling tempo in football coaching",
    ],
  },

  // ── Set Pieces ────────────────────────────────────────────────
  {
    id: "attacking-set-pieces",
    label: "Attacking Set Pieces",
    category: "Set Pieces",
    summary:
      "Organised corner and free-kick routines that create clear chances from dead-ball situations.",
    relevantTo: ["Defender", "Midfielder", "Forward"],
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
    relevantTo: ["Goalkeeper", "Defender", "Midfielder"],
    searchQueries: [
      "defending corners marking system training drill",
      "how to defend set pieces youth football",
    ],
  },
];

export function getConcept(id: string): TacticalConcept | undefined {
  return TACTICAL_CONCEPTS.find((c) => c.id === id);
}

/** Concepts that matter most to a given position group. */
export function conceptsForPositionGroup(group: string): TacticalConcept[] {
  return TACTICAL_CONCEPTS.filter((c) => c.relevantTo.includes(group));
}

/** Build a guaranteed-valid YouTube search-results URL for a query. */
export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
