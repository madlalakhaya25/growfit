// Pre-built play templates for the tactical board.
//
// Each template is authored compactly as a set of tokens plus ordered steps
// (where every token sits at that step, and what lines are drawn). `expandTemplate`
// turns that into the board's data shape — the same {tokens, shapes, frames}
// a saved play uses — so a coach can load one, tweak it, and save it as theirs.
//
// Coordinates are board space: 100 wide x 150 tall, attacking upward (our goal
// at the bottom, y=150). Templates use only the players involved in the pattern,
// which is how a coach diagrams it on a whiteboard.

export type TemplateShape = [kind: "run" | "pass" | "dribble", x1: number, y1: number, x2: number, y2: number];

interface TemplateToken {
  id: string;
  label: string;
  kind: "player" | "opponent" | "ball";
  group: string;
}
interface TemplateStep {
  pos: Record<string, [number, number]>;
  shapes?: TemplateShape[];
}
export interface PlayTemplate {
  id: string;
  label: string;
  /** Concept id from lib/tactics.ts, used to pre-tag the play. */
  conceptId: string;
  summary: string;
  /** Set when the template belongs under a heading in the picker. */
  group?: "Set pieces";
  tokens: TemplateToken[];
  steps: TemplateStep[];
}

const P = (id: string, label: string, group: string): TemplateToken => ({ id, label, kind: "player", group });
const O = (id: string, label: string): TemplateToken => ({ id, label, kind: "opponent", group: "Opponent" });
const BALL: TemplateToken = { id: "ball", label: "", kind: "ball", group: "Ball" };

export const PLAY_TEMPLATES: PlayTemplate[] = [
  {
    id: "tpl-build-split",
    label: "Build from the back — split the centre-backs",
    conceptId: "build-from-back",
    summary: "Centre-backs split wide of the box, full-backs push on, the six drops in to give an angle.",
    tokens: [
      P("gk", "GK", "Goalkeeper"), P("lcb", "LCB", "Defender"), P("rcb", "RCB", "Defender"),
      P("lb", "LB", "Defender"), P("rb", "RB", "Defender"), P("six", "6", "Midfielder"),
      O("o1", "9"), BALL,
    ],
    steps: [
      {
        pos: { gk: [50, 140], lcb: [38, 124], rcb: [62, 124], lb: [16, 108], rb: [84, 108], six: [50, 100], o1: [50, 108], ball: [50, 140] },
      },
      {
        pos: { gk: [50, 140], lcb: [26, 128], rcb: [74, 128], lb: [12, 90], rb: [88, 90], six: [50, 106], o1: [50, 116], ball: [50, 140] },
        shapes: [["run", 38, 124, 26, 128], ["run", 62, 124, 74, 128], ["run", 16, 108, 12, 90], ["run", 84, 108, 88, 90]],
      },
      {
        pos: { gk: [50, 140], lcb: [26, 128], rcb: [74, 128], lb: [12, 90], rb: [88, 90], six: [46, 98], o1: [56, 120], ball: [26, 128] },
        shapes: [["pass", 50, 140, 26, 128], ["run", 50, 106, 46, 98]],
      },
      {
        pos: { gk: [50, 138], lcb: [30, 116], rcb: [74, 128], lb: [12, 78], rb: [88, 90], six: [44, 92], o1: [60, 124], ball: [30, 116] },
        shapes: [["dribble", 26, 128, 30, 116], ["run", 12, 90, 12, 78], ["pass", 30, 116, 44, 92]],
      },
    ],
  },
  {
    id: "tpl-press-trigger",
    label: "High press — trigger on the pass back",
    conceptId: "high-press",
    summary: "Striker presses on the back pass, wingers pinch in to cut the outside, midfield steps up together.",
    tokens: [
      P("st", "ST", "Forward"), P("lw", "LW", "Forward"), P("rw", "RW", "Forward"),
      P("cm1", "CM", "Midfielder"), P("cm2", "CM", "Midfielder"),
      O("ogk", "1"), O("ocb1", "4"), O("ocb2", "5"), BALL,
    ],
    steps: [
      {
        pos: { st: [50, 46], lw: [22, 50], rw: [78, 50], cm1: [38, 72], cm2: [62, 72], ogk: [50, 12], ocb1: [36, 30], ocb2: [64, 30], ball: [36, 30] },
      },
      {
        pos: { st: [50, 40], lw: [22, 48], rw: [78, 48], cm1: [38, 70], cm2: [62, 70], ogk: [50, 12], ocb1: [36, 26], ocb2: [64, 30], ball: [50, 16] },
        shapes: [["pass", 36, 30, 50, 16]],
      },
      {
        pos: { st: [50, 24], lw: [32, 36], rw: [68, 36], cm1: [42, 58], cm2: [58, 58], ogk: [50, 12], ocb1: [32, 28], ocb2: [68, 28], ball: [50, 16] },
        shapes: [["run", 50, 40, 50, 24], ["run", 22, 48, 32, 36], ["run", 78, 48, 68, 36], ["run", 38, 70, 42, 58], ["run", 62, 70, 58, 58]],
      },
    ],
  },
  {
    id: "tpl-counter",
    label: "Counter-attack — win it and go",
    conceptId: "counter-attack",
    summary: "Win the ball in midfield, first pass forward, wingers stretch the pitch and the striker runs in behind.",
    tokens: [
      P("six", "6", "Midfielder"), P("cm", "CM", "Midfielder"), P("st", "ST", "Forward"),
      P("lw", "LW", "Forward"), P("rw", "RW", "Forward"), O("o1", "8"), BALL,
    ],
    steps: [
      {
        pos: { six: [50, 96], cm: [40, 82], st: [50, 56], lw: [20, 66], rw: [80, 66], o1: [46, 90], ball: [50, 96] },
      },
      {
        pos: { six: [50, 94], cm: [44, 74], st: [50, 44], lw: [16, 52], rw: [84, 52], o1: [50, 96], ball: [44, 74] },
        shapes: [["pass", 50, 96, 44, 74], ["run", 50, 56, 50, 44], ["run", 20, 66, 16, 52], ["run", 80, 66, 84, 52]],
      },
      {
        pos: { six: [50, 90], cm: [46, 68], st: [56, 26], lw: [14, 38], rw: [86, 38], o1: [50, 92], ball: [56, 26] },
        shapes: [["pass", 44, 74, 56, 26], ["run", 50, 44, 56, 26], ["run", 16, 52, 14, 38], ["run", 84, 52, 86, 38]],
      },
    ],
  },
  {
    id: "tpl-switch",
    label: "Switch the play to the far side",
    conceptId: "switching-play",
    summary: "Draw the opponent to one side, then switch quickly to the free full-back on the opposite flank.",
    tokens: [
      P("lb", "LB", "Defender"), P("cm", "CM", "Midfielder"), P("six", "6", "Midfielder"),
      P("rb", "RB", "Defender"), P("rw", "RW", "Forward"),
      O("o1", "7"), O("o2", "8"), BALL,
    ],
    steps: [
      {
        pos: { lb: [14, 92], cm: [34, 84], six: [50, 96], rb: [86, 92], rw: [82, 60], o1: [26, 88], o2: [44, 90], ball: [14, 92] },
      },
      {
        pos: { lb: [14, 92], cm: [32, 80], six: [50, 98], rb: [88, 84], rw: [84, 54], o1: [22, 86], o2: [38, 86], ball: [32, 80] },
        shapes: [["pass", 14, 92, 32, 80], ["run", 86, 92, 88, 84]],
      },
      {
        pos: { lb: [14, 88], cm: [34, 78], six: [50, 94], rb: [88, 80], rw: [86, 48], o1: [24, 82], o2: [40, 82], ball: [50, 94] },
        shapes: [["pass", 32, 80, 50, 94]],
      },
      {
        pos: { lb: [16, 84], cm: [36, 76], six: [50, 92], rb: [88, 76], rw: [86, 44], o1: [30, 80], o2: [44, 80], ball: [88, 76] },
        shapes: [["pass", 50, 94, 88, 76], ["run", 88, 80, 88, 76]],
      },
    ],
  },
  {
    id: "tpl-corner-near",
    label: "Corner routine — near post run",
    conceptId: "attacking-set-pieces",
    group: "Set pieces",
    summary: "Two players start central, one attacks the near post to flick on, the second arrives at the back post.",
    tokens: [
      P("tak", "Taker", "Midfielder"), P("np", "Near", "Forward"), P("bp", "Back", "Defender"),
      P("edge", "Edge", "Midfielder"), O("ogk", "1"), BALL,
    ],
    steps: [
      {
        pos: { tak: [6, 6], np: [50, 26], bp: [54, 30], edge: [50, 40], ogk: [50, 10], ball: [6, 6] },
      },
      {
        pos: { tak: [6, 6], np: [38, 14], bp: [62, 20], edge: [50, 38], ogk: [50, 10], ball: [6, 6] },
        shapes: [["run", 50, 26, 38, 14], ["run", 54, 30, 62, 20]],
      },
      {
        pos: { tak: [7, 7], np: [36, 12], bp: [64, 16], edge: [50, 36], ogk: [48, 11], ball: [36, 12] },
        shapes: [["pass", 6, 6, 36, 12], ["run", 62, 20, 64, 16]],
      },
      {
        pos: { tak: [7, 7], np: [36, 12], bp: [64, 14], edge: [50, 34], ogk: [46, 11], ball: [64, 14] },
        shapes: [["pass", 36, 12, 64, 14]],
      },
    ],
  },
  {
    id: "tpl-corner-short",
    label: "Corner routine: short and in",
    conceptId: "attacking-set-pieces",
    group: "Set pieces",
    summary: "A short corner draws the defender out, then the ball is worked to the edge of the box for a shot or a cross from a better angle.",
    tokens: [
      P("tak", "Taker", "Midfielder"), P("short", "Short", "Midfielder"), P("edge", "Edge", "Midfielder"),
      P("far", "Far", "Forward"), O("o1", "4"), O("ogk", "1"), BALL,
    ],
    steps: [
      { pos: { tak: [6, 6], short: [22, 16], edge: [46, 40], far: [62, 20], o1: [14, 10], ogk: [50, 10], ball: [6, 6] } },
      { pos: { tak: [6, 6], short: [22, 16], edge: [46, 40], far: [62, 20], o1: [16, 12], ogk: [50, 10], ball: [22, 16] }, shapes: [["pass", 6, 6, 22, 16]] },
      { pos: { tak: [8, 12], short: [24, 22], edge: [46, 40], far: [64, 16], o1: [20, 16], ogk: [50, 10], ball: [46, 40] }, shapes: [["pass", 22, 16, 46, 40], ["run", 62, 20, 64, 16]] },
      { pos: { tak: [8, 12], short: [24, 22], edge: [46, 40], far: [64, 12], o1: [22, 20], ogk: [52, 10], ball: [64, 12] }, shapes: [["pass", 46, 40, 64, 12]] },
    ],
  },
  {
    id: "tpl-corner-far",
    label: "Corner routine: screen and far post",
    conceptId: "attacking-set-pieces",
    group: "Set pieces",
    summary: "One player screens the keeper, a decoy attacks the near post, and the ball goes to the tallest player arriving late at the far post.",
    tokens: [
      P("tak", "Taker", "Midfielder"), P("scr", "Screen", "Defender"), P("dec", "Decoy", "Forward"),
      P("tall", "Tall", "Defender"), P("edge", "Edge", "Midfielder"), O("ogk", "1"), BALL,
    ],
    steps: [
      { pos: { tak: [6, 6], scr: [46, 12], dec: [50, 24], tall: [52, 30], edge: [50, 42], ogk: [50, 10], ball: [6, 6] } },
      { pos: { tak: [6, 6], scr: [46, 12], dec: [36, 12], tall: [60, 24], edge: [50, 42], ogk: [50, 10], ball: [6, 6] }, shapes: [["run", 50, 24, 36, 12], ["run", 52, 30, 60, 24]] },
      { pos: { tak: [6, 6], scr: [46, 12], dec: [36, 12], tall: [66, 12], edge: [50, 40], ogk: [49, 10], ball: [66, 12] }, shapes: [["pass", 6, 6, 66, 12], ["run", 60, 24, 66, 12]] },
    ],
  },
  {
    id: "tpl-free-kick-direct",
    label: "Free kick: direct shot with a decoy",
    conceptId: "attacking-set-pieces",
    group: "Set pieces",
    summary: "A decoy runs over the ball to pull the wall's attention, then the taker shoots round the end of the wall.",
    tokens: [
      P("tak", "Taker", "Forward"), P("dec", "Decoy", "Midfielder"), P("rb", "Rebound", "Forward"),
      O("w1", "W"), O("w2", "W"), O("w3", "W"), O("ogk", "1"), BALL,
    ],
    steps: [
      { pos: { tak: [56, 54], dec: [48, 56], rb: [62, 32], w1: [42, 42], w2: [48, 42], w3: [54, 42], ogk: [50, 10], ball: [50, 54] } },
      { pos: { tak: [56, 54], dec: [52, 52], rb: [62, 30], w1: [42, 42], w2: [48, 42], w3: [54, 42], ogk: [50, 10], ball: [50, 54] }, shapes: [["run", 48, 56, 52, 52]] },
      { pos: { tak: [52, 54], dec: [52, 52], rb: [62, 28], w1: [42, 42], w2: [48, 42], w3: [54, 42], ogk: [46, 10], ball: [36, 4] }, shapes: [["pass", 50, 54, 36, 4]] },
    ],
  },
  {
    id: "tpl-free-kick-cross",
    label: "Free kick: wide cross to the far post",
    conceptId: "attacking-set-pieces",
    group: "Set pieces",
    summary: "From wide, three runners attack different spaces at once: near post, penalty spot and the far post where the ball is aimed.",
    tokens: [
      P("tak", "Taker", "Midfielder"), P("n", "Near", "Forward"), P("m", "Spot", "Midfielder"),
      P("f", "Far", "Defender"), O("d1", "4"), O("d2", "5"), O("d3", "6"), O("ogk", "1"), BALL,
    ],
    steps: [
      { pos: { tak: [10, 62], n: [44, 36], m: [54, 38], f: [64, 40], d1: [40, 30], d2: [52, 30], d3: [64, 30], ogk: [50, 10], ball: [10, 62] } },
      { pos: { tak: [10, 62], n: [40, 22], m: [52, 26], f: [68, 22], d1: [40, 28], d2: [52, 28], d3: [64, 28], ogk: [50, 10], ball: [10, 62] }, shapes: [["run", 44, 36, 40, 22], ["run", 54, 38, 52, 26], ["run", 64, 40, 68, 22]] },
      { pos: { tak: [10, 62], n: [40, 22], m: [52, 26], f: [68, 20], d1: [42, 26], d2: [54, 26], d3: [66, 28], ogk: [52, 10], ball: [68, 20] }, shapes: [["pass", 10, 62, 68, 20]] },
    ],
  },
  {
    id: "tpl-defend-corner",
    label: "Defending a corner: zonal with a counter outlet",
    conceptId: "defending-set-pieces",
    group: "Set pieces",
    summary: "Players hold zones across the six-yard box and penalty spot, the keeper commands the near side, and one player stays high as the outlet.",
    tokens: [
      P("gk", "GK", "Goalkeeper"), P("z1", "Z1", "Defender"), P("z2", "Z2", "Defender"), P("z3", "Z3", "Midfielder"),
      P("z4", "Z4", "Midfielder"), P("out", "Out", "Forward"), O("tak", "7"), O("a1", "9"), O("a2", "10"), BALL,
    ],
    steps: [
      { pos: { gk: [50, 140], z1: [42, 134], z2: [58, 134], z3: [50, 126], z4: [38, 122], out: [50, 80], tak: [94, 144], a1: [46, 128], a2: [60, 124], ball: [94, 144] } },
      { pos: { gk: [52, 140], z1: [42, 134], z2: [58, 134], z3: [50, 126], z4: [38, 122], out: [50, 80], tak: [94, 144], a1: [48, 130], a2: [62, 126], ball: [58, 132] }, shapes: [["pass", 94, 144, 58, 132]] },
      { pos: { gk: [52, 140], z1: [42, 134], z2: [58, 132], z3: [50, 126], z4: [38, 122], out: [50, 70], tak: [94, 144], a1: [48, 130], a2: [62, 126], ball: [58, 132] }, shapes: [["run", 50, 80, 50, 70]] },
      { pos: { gk: [52, 140], z1: [42, 134], z2: [58, 132], z3: [50, 120], z4: [38, 122], out: [50, 64], tak: [94, 144], a1: [48, 130], a2: [62, 126], ball: [50, 64] }, shapes: [["pass", 58, 132, 50, 64]] },
    ],
  },
];

let seq = 0;
const nid = (p: string) => `${p}-tpl-${++seq}`;

/** Expand a template into the board's saved-play data shape. */
export function expandTemplate(tpl: PlayTemplate) {
  const first = tpl.steps[0];

  const tokens = tpl.tokens.map((t) => ({
    id: t.id,
    label: t.label,
    x: first.pos[t.id]?.[0] ?? 50,
    y: first.pos[t.id]?.[1] ?? 75,
    kind: t.kind,
    group: t.group,
  }));

  const toShapes = (step: TemplateStep) =>
    (step.shapes ?? []).map((s) => ({
      id: nid("s"),
      kind: s[0],
      pts: [{ x: s[1], y: s[2] }, { x: s[3], y: s[4] }],
    }));

  const frames = tpl.steps.map((step) => ({
    id: nid("f"),
    tokens: tpl.tokens.map((t) => ({
      id: t.id,
      x: step.pos[t.id]?.[0] ?? first.pos[t.id]?.[0] ?? 50,
      y: step.pos[t.id]?.[1] ?? first.pos[t.id]?.[1] ?? 75,
    })),
    shapes: toShapes(step),
  }));

  // Show every arrow at rest so the play reads as a diagram before it is played;
  // playback then swaps in each step's own lines as the movement unfolds.
  const allShapes = tpl.steps.flatMap((step) => toShapes(step));
  return { tokens, shapes: allShapes, frames };
}
