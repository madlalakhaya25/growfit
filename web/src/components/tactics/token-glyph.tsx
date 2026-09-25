import { GROUP_COLOR, type Token } from "@/lib/board-model";

/**
 * What goes inside a token's disc: a formation slot number stays a number
 * ("7"), a real player shows their initial — the full name sits in the
 * pill underneath, so the disc only has to be recognisable at a glance.
 */
export function tokenBadge(label: string): string {
  const t = label.trim();
  if (!t) return "";
  if (/^\d{1,2}$/.test(t)) return t;
  return t[0].toUpperCase();
}

/**
 * Shared gradients for TokenGlyph. One set per <svg>, keyed by `prefix`,
 * so the board and a viewer on the same page never collide. The gloss and
 * rim are neutral white/black overlays laid over a flat group-colour disc,
 * which is what lets one pair of gradients serve every group colour.
 */
export function TokenDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      <radialGradient id={`${prefix}-gloss`} cx="35%" cy="28%" r="70%">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity={0.08} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.28} />
      </radialGradient>
      <radialGradient id={`${prefix}-shadow`} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#000000" stopOpacity={0.45} />
        <stop offset="1" stopColor="#000000" stopOpacity={0} />
      </radialGradient>
      <clipPath id={`${prefix}-ball-clip`}>
        <circle r={BALL_R} />
      </clipPath>
    </defs>
  );
}

const R = 4.2;
const BALL_R = 2.4;

/**
 * One board token — a player, an opponent, or the ball — drawn around the
 * origin (the caller positions it with a translate). Shared by the
 * interactive board and the read-only player-facing viewer.
 */
export function TokenGlyph({
  tok,
  prefix,
  showName = true,
  selected = false,
  dimmed = false,
}: {
  tok: Pick<Token, "kind" | "group" | "label">;
  prefix: string;
  showName?: boolean;
  selected?: boolean;
  dimmed?: boolean;
}) {
  if (tok.kind === "ball") return <BallGlyph prefix={prefix} />;

  const fill = GROUP_COLOR[tok.group] ?? GROUP_COLOR.Midfielder;
  const isOpp = tok.kind === "opponent";
  const badge = tokenBadge(tok.label);
  const name = !isOpp && showName && tok.label && !/^\d{1,2}$/.test(tok.label.trim()) ? tok.label : "";
  // Rough text width at fontSize 2.5 — good enough to size the pill without
  // measuring the DOM (which the PNG export clone couldn't do anyway).
  const pillW = name.length * 1.45 + 2.6;

  return (
    <g opacity={dimmed ? 0.45 : 1}>
      {/* Contact shadow */}
      <ellipse cx={0.5} cy={R * 0.75} rx={R * 1.05} ry={R * 0.5} fill={`url(#${prefix}-shadow)`} />

      {selected && (
        <>
          <circle r={R + 2.4} fill="#ffffff" opacity={0.18} />
          <circle r={R + 2} fill="none" stroke="#ffffff" strokeWidth={0.6} strokeDasharray="1.6 1.1">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Kit disc + gloss */}
      <circle r={R} fill={fill} />
      <circle r={R} fill={`url(#${prefix}-gloss)`} />
      {/* Trim: white for our side, a red away-kit band for the opponent. */}
      <circle
        r={R - 0.35}
        fill="none"
        stroke={isOpp ? "#f43f5e" : "rgba(255,255,255,0.9)"}
        strokeWidth={isOpp ? 0.7 : 0.5}
      />
      <circle r={R + 0.15} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={0.3} />

      {badge && (
        <text
          y={1.25}
          textAnchor="middle"
          fontSize={badge.length > 1 ? 3.2 : 3.6}
          fontWeight={800}
          fill="#ffffff"
          style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.3)", strokeWidth: 0.18 }}
        >
          {badge}
        </text>
      )}

      {name && (
        <g transform={`translate(0 ${R + 3.3})`}>
          <rect x={-pillW / 2} y={-2.1} width={pillW} height={3.3} rx={1.65} fill="rgba(15,23,42,0.82)" />
          <text y={0.35} textAnchor="middle" fontSize={2.5} fontWeight={600} fill="#ffffff">
            {name}
          </text>
        </g>
      )}
    </g>
  );
}

/** A classic black-and-white football: white ball, centre pentagon, and
 * five partial patches round the edge. */
function BallGlyph({ prefix }: { prefix: string }) {
  const r = BALL_R;
  const pent = (cx: number, cy: number, s: number, rot = -90) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = ((rot + i * 72) * Math.PI) / 180;
      return `${(cx + Math.cos(a) * s).toFixed(2)},${(cy + Math.sin(a) * s).toFixed(2)}`;
    }).join(" ");
  const clipId = `${prefix}-ball-clip`;
  return (
    <g>
      <ellipse cx={0.4} cy={r * 0.8} rx={r * 1.1} ry={r * 0.45} fill={`url(#${prefix}-shadow)`} />
      <circle r={r} fill="#f8fafc" />
      <g clipPath={`url(#${clipId})`} fill="#111827">
        <polygon points={pent(0, 0, 0.95)} />
        {[0, 72, 144, 216, 288].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return <polygon key={deg} points={pent(Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0.85, deg + 90)} />;
        })}
      </g>
      <circle r={r} fill={`url(#${prefix}-gloss)`} />
      <circle r={r} fill="none" stroke="#0f172a" strokeWidth={0.3} />
    </g>
  );
}
