// Stepping through a play one move at a time, for a player reading a shared
// play on their phone. Pure: the pose at a step is read straight from that
// step's captured frame (no easing), and each step is described from the
// arrows that first appear in it.

import type { Frame, Shape, Token } from "@/lib/board-model";

type Base = Pick<Token, "id" | "label" | "kind"> & { x: number; y: number };

/** Every token where it stands at step `index` (clamped), and the arrows showing then. */
export function poseAtStep<T extends Base>(baseTokens: T[], frames: Frame[], index: number): { tokens: T[]; shapes: Shape[] } {
  const frame = frames[Math.max(0, Math.min(index, frames.length - 1))];
  if (!frame) return { tokens: baseTokens, shapes: [] };
  return {
    tokens: baseTokens.map((t) => {
      const at = frame.tokens.find((f) => f.id === t.id);
      return at ? { ...t, x: at.x, y: at.y } : t;
    }),
    shapes: frame.shapes ?? [],
  };
}

const VERB: Partial<Record<Shape["kind"], string>> = {
  run: "runs",
  dribble: "dribbles",
  press: "presses",
  pass: "passes",
  shot: "shoots",
};

/** How far from an arrow's start a token can be and still be its mover. */
const GRAB = 10;

/**
 * What happens at step `index`, as short sentences about our own players: the
 * arrows that first show up in this step, each named for the player it starts
 * on. Step 0 is the starting picture. What the opposition does is the coach's
 * framing, so it is left out, as it is from a player's job list.
 */
export function describeStep<T extends Base>(baseTokens: T[], frames: Frame[], index: number): string[] {
  if (index <= 0 || index >= frames.length) return ["Where everyone starts."];
  const before = poseAtStep(baseTokens, frames, index - 1);
  const seen = new Set(before.shapes.map((s) => s.id));
  const out: string[] = [];
  for (const sh of frames[index].shapes ?? []) {
    const verb = VERB[sh.kind];
    if (!verb || seen.has(sh.id) || sh.pts.length < 2) continue;
    const start = sh.pts[0];
    let mover: T | null = null;
    let best = GRAB;
    for (const t of before.tokens) {
      if (t.kind !== "player") continue;
      const d = Math.hypot(t.x - start.x, t.y - start.y);
      if (d <= best) {
        best = d;
        mover = t;
      }
    }
    if (mover) out.push(`${mover.label} ${verb}.`);
  }
  return out.length ? out : ["The ball and the other players move on."];
}
