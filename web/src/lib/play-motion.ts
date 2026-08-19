// Turn drawn arrows into movement.
//
// Drawing an arrow on a tactical board means "this player runs here" — but the
// animation used to replay only positions captured by hand, so a coach who drew
// a play and pressed Play saw nothing move. This derives the movement the arrows
// already describe:
//
//   run      — the nearest player to the arrow's start moves to its end
//   dribble  — same, and the ball travels with them
//   pass     — the ball moves to the arrow's end
//   freehand — ignored; it marks a zone rather than a movement
//
// Arrows are applied in the order they were drawn, each becoming one step, so a
// sequence a coach drew reads back as a sequence.

export interface MotionToken {
  id: string;
  x: number;
  y: number;
  kind: "player" | "opponent" | "ball";
}
export interface MotionShape {
  id: string;
  kind: "run" | "pass" | "dribble" | "free";
  pts: { x: number; y: number }[];
}
export interface MotionFrame {
  id: string;
  tokens: { id: string; x: number; y: number }[];
  shapes: MotionShape[];
}

/** How close an arrow's start must be to a token to be treated as its movement. */
const GRAB_RADIUS = 10;

let seq = 0;
const fid = () => `auto-f-${++seq}`;

export function framesFromShapes(
  tokens: MotionToken[],
  shapes: MotionShape[]
): MotionFrame[] {
  const arrows = shapes.filter((s) => s.kind !== "free" && s.pts.length >= 2);
  if (arrows.length === 0 || tokens.length === 0) return [];

  const ball = tokens.find((t) => t.kind === "ball");
  // Working positions, mutated as each arrow is applied in turn.
  const pos = new Map(tokens.map((t) => [t.id, { x: t.x, y: t.y }]));

  const snapshot = (shapesSoFar: MotionShape[]): MotionFrame => ({
    id: fid(),
    tokens: tokens.map((t) => ({ id: t.id, ...pos.get(t.id)! })),
    shapes: shapesSoFar,
  });

  const frames: MotionFrame[] = [snapshot([])];
  const drawnSoFar: MotionShape[] = [];
  let moved = false;

  for (const arrow of arrows) {
    const from = arrow.pts[0];
    const to = arrow.pts[arrow.pts.length - 1];
    drawnSoFar.push(arrow);

    if (arrow.kind === "pass") {
      // A pass moves the ball, not a player.
      if (ball) {
        pos.set(ball.id, { x: to.x, y: to.y });
        moved = true;
      }
    } else {
      // Nearest player/opponent to where the arrow starts.
      let best: { id: string; d: number } | null = null;
      for (const t of tokens) {
        if (t.kind === "ball") continue;
        const p = pos.get(t.id)!;
        const d = Math.hypot(p.x - from.x, p.y - from.y);
        if (!best || d < best.d) best = { id: t.id, d };
      }
      if (best && best.d <= GRAB_RADIUS) {
        pos.set(best.id, { x: to.x, y: to.y });
        moved = true;
        // A dribble carries the ball along with the player.
        if (arrow.kind === "dribble" && ball) {
          pos.set(ball.id, { x: to.x, y: to.y });
        }
      }
    }

    frames.push(snapshot([...drawnSoFar]));
  }

  // If no arrow was close enough to anything, there is nothing to animate.
  return moved ? frames : [];
}
