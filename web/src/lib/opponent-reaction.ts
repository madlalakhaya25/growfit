// The opposition reacting to a play, with no AI: as the ball moves from step to
// step, any opponent the coach has not moved themselves slides and squeezes as a
// zonal unit toward it (shiftToBall, the same rule as Auto-shift), so a pass
// across the pitch pulls the block over and shows where it opens up.
//
// Deterministic and pure: the same play always gets the same reaction, and it
// only repositions opponents on the board. It never changes the coach's own
// tokens, arrows or captured steps.

import { shiftToBall } from "@/lib/board-coaching";
import type { Token } from "@/lib/board-model";

type Anchor = Pick<Token, "id" | "kind" | "group" | "x" | "y" | "label">;
interface ReactFrame {
  tokens: { id: string; x: number; y: number }[];
}

const SAME = 0.01;

/**
 * `frames[0]` is the resting position and is left alone. In every later frame,
 * each opponent still where it started (not moved by an arrow the coach drew)
 * goes to where the block would stand for that frame's ball.
 */
export function addOpponentReaction<F extends ReactFrame>(frames: F[], start: Anchor[]): F[] {
  const ball = start.find((t) => t.kind === "ball");
  const opponents = start.filter((t) => t.kind === "opponent");
  if (frames.length < 2 || !ball || opponents.length < 3) return frames;
  const home = new Map(opponents.map((o) => [o.id, o]));

  return frames.map((frame, i) => {
    if (i === 0) return frame;
    const at = frame.tokens.find((t) => t.id === ball.id);
    if (!at) return frame;
    const shifted = shiftToBall(opponents, { x: at.x, y: at.y }, "opponent");
    return {
      ...frame,
      tokens: frame.tokens.map((t) => {
        const h = home.get(t.id);
        const p = shifted.get(t.id);
        const unmoved = h && Math.abs(t.x - h.x) < SAME && Math.abs(t.y - h.y) < SAME;
        return unmoved && p ? { ...t, x: p.x, y: p.y } : t;
      }),
    };
  });
}
