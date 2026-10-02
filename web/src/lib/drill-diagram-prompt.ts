// The instructions that make a model draw a drill in the shape
// lib/drill-diagram.ts accepts. Plain text, kept beside the validator so the
// numbers in one cannot drift from the other.

import { SPACE_OPTIONS, type SessionConstraints } from "@/lib/session-constraints";

const COORDINATES = `Coordinates: x runs left to right, y runs top to bottom, in board units. Choose the pitch that matches the setup:
- "grid-small": 60 wide by 60 tall = a 20m x 20m square. Playable area 2 to 58 on both axes.
- "grid-large": 60 wide by 80 tall = about 30m x 40m. Playable x 2 to 58, y 2 to 78.
- "half": 100 wide by 75 tall = half a pitch, goal on the top edge (y near 0), penalty box x 26 to 74, y 2 to 22.
- "full": 100 wide by 150 tall, goals at the top (y near 0) and bottom (y near 150).`;

const DRAWING_RULES = `Draw it like this:
- "tokens": one entry per player or ball, with role "team", "opponent", "keeper" or "ball". Show the numbers the drill actually uses (a 4v2 rondo has four "team" and two "opponent" tokens), never more than the squad size. Keep players at least 9 units apart so they do not overlap, and put a ball a few units beside the player who has it.
- "equipment": cones, goals, ladders and so on, only kit the coach has. Mark a square with four cones at its corners; mark a gate with two cones about 6 units apart.
- "moves": arrows for the movement. "from" is the 0-based index of a token in your tokens list; end the arrow on another token with "toToken" (its index), or on a point with "x" and "y". Kinds: "pass" (dashed), "run", "dribble", "shot", "press". Use a small "curve" (-0.3 to 0.3) to bend an arrow round a player. Draw only the first phase of the drill, at most 8 arrows.
- "zones": an area to mark out, as a list of points; "hatch": true for a "press here / no-go" area. At most 2.`;

export interface DiagramBrief {
  drills: { name: string; setup: string; instructions: string }[];
  constraints: SessionConstraints;
}

/** The prompt for the call that draws a finished plan's drills. */
export function buildDiagramPrompt({ drills, constraints }: DiagramBrief): string {
  const space = SPACE_OPTIONS.find((s) => s.value === constraints.space)?.hint;
  const kit = constraints.kit?.join(", ") || "none";
  const limits = [
    `Players available: ${constraints.squadSize}`,
    space ? `Space: ${space}` : null,
    constraints.kit ? `Kit available: ${kit}` : null,
  ].filter(Boolean);
  const list = drills
    .map((d, i) => `DRILL ${i}: ${d.name}\nSetup: ${d.setup}\nInstructions: ${d.instructions}`)
    .join("\n\n");

  return `Draw each of these training drills as a pitch diagram for the coach. Only draw a drill you can lay out confidently from its description; leave a drill out of the answer rather than guess, a missing diagram is better than a wrong one.

${limits.join("\n")}

${list}

${COORDINATES}

${DRAWING_RULES}

Answer with one entry per drill you drew: "drill" is the number after DRILL above, "diagram" is its layout.`;
}
