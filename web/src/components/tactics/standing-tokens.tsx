import type { Pitch, Token } from "@/lib/board-model";
import { TokenGlyph } from "@/components/tactics/token-glyph";

/** How far the 3D view tilts the pitch back, in degrees. */
export const TILT_DEG = 50;

// The token's own box in board units: the shirt sits round the origin with
// the name tag over its head, and its feet about 4.5 units down. Anything
// below the feet would sink under the tilted grass, hence the tag on top.
const BOX = { x: -8, y: -11, w: 16, h: 16 };
const FEET = (4.5 - BOX.y) / BOX.h; // where the token touches the grass, 0–1 down the box

/**
 * The players in the 3D view. Drawn as HTML over the tilted pitch, each one
 * turned back up by the same angle so they stand on the grass facing the
 * camera instead of lying flat on it. Sized in percent of the pitch, so they
 * scale with the board; positions follow playback like the flat tokens do.
 * Gradients come from the board's own <TokenDefs>, already in the document.
 */
export function StandingTokens({
  tokens, pitch, prefix, showNames, selectedId,
}: Readonly<{
  tokens: Token[];
  pitch: Pitch;
  prefix: string;
  showNames: boolean;
  selectedId: string | null;
}>) {
  // Paint back to front, so a nearer player overlaps the one behind.
  const ordered = [...tokens].sort((a, b) => a.y - b.y);
  return (
    <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d" }} aria-hidden="true">
      {ordered.map((tok) => (
        <div
          key={tok.id}
          className="absolute"
          style={{
            left: `${(tok.x / pitch.w) * 100}%`,
            top: `${(tok.y / pitch.h) * 100}%`,
            width: `${(BOX.w / pitch.w) * 100}%`,
            transform: `translate(-50%, -${FEET * 100}%) rotateX(-${TILT_DEG}deg)`,
            transformOrigin: `50% ${FEET * 100}%`,
          }}
        >
          <svg viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`} className="block h-auto w-full overflow-visible">
            <TokenGlyph tok={tok} prefix={prefix} showName={showNames} selected={tok.id === selectedId} nameAbove />
          </svg>
        </div>
      ))}
    </div>
  );
}
