import type { Token } from "@/lib/board-model";

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

/** Our kit: Growfit red outfield shirts, an amber keeper's shirt. */
export const KIT = { home: "#a71817", keeper: "#f5b400", opponent: "#1f2a44", highlight: "#ffd60a" } as const;

/** A football shirt in a 40×40 box, collar at the top; drawn centred on the chest. */
const SHIRT_PATH =
  "M13 4 L7 6.5 L1.5 12.5 L5.5 18.5 L10 15.5 L10 36 Q10 37.5 11.5 37.5 L28.5 37.5 Q30 37.5 30 36 L30 15.5 L34.5 18.5 L38.5 12.5 L33 6.5 L27 4 Q20 9.5 13 4 Z";
const SHIRT_SCALE = 0.27;

/**
 * One board token — a player, an opponent, or the ball — drawn around the
 * origin (the caller positions it with a translate). Shared by the
 * interactive board and the read-only player-facing viewer.
 *
 * Our players wear a shirt with their number or initial on the chest, so a
 * child sees "that's us"; the opposition are plain navy discs, so the two
 * sides read apart at a glance on any pitch theme. The selected player gets
 * a yellow outline and name tag.
 */
export function TokenGlyph({
  tok,
  prefix,
  showName = true,
  selected = false,
  dimmed = false,
  nameAbove = false,
}: Readonly<{
  tok: Pick<Token, "kind" | "group" | "label">;
  prefix: string;
  showName?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  /** Put the name tag over the head instead of under the feet (3D view, where under the feet is underground). */
  nameAbove?: boolean;
}>) {
  if (tok.kind === "ball") return <BallGlyph prefix={prefix} />;

  const isOpp = tok.kind === "opponent";
  const badge = tokenBadge(tok.label);
  const name = !isOpp && showName && tok.label && !/^\d{1,2}$/.test(tok.label.trim()) ? tok.label : "";
  // Rough text width at fontSize 2.5 — good enough to size the pill without
  // measuring the DOM (which the PNG export clone couldn't do anyway).
  const pillW = name.length * 1.45 + 2.6;

  if (isOpp) {
    return (
      <g opacity={dimmed ? 0.45 : 1}>
        <ellipse cx={0.4} cy={R * 0.7} rx={R * 0.95} ry={R * 0.45} fill={`url(#${prefix}-shadow)`} />
        {selected && <circle r={R + 1.4} fill="none" stroke={KIT.highlight} strokeWidth={0.7} />}
        <circle r={R * 0.9} fill={KIT.opponent} />
        <circle r={R * 0.9} fill={`url(#${prefix}-gloss)`} opacity={0.6} />
        <circle r={R * 0.9 - 0.3} fill="none" stroke="#ffffff" strokeWidth={0.6} />
        {badge && (
          <text y={1.15} textAnchor="middle" fontSize={badge.length > 1 ? 2.9 : 3.3} fontWeight={800} fill="#ffffff">
            {badge}
          </text>
        )}
      </g>
    );
  }

  const keeper = tok.group === "Goalkeeper";
  const shirt = keeper ? KIT.keeper : KIT.home;
  const ink = keeper ? "#1d1d1f" : "#ffffff";

  return (
    <g opacity={dimmed ? 0.45 : 1}>
      {/* Contact shadow */}
      <ellipse cx={0.5} cy={R * 0.95} rx={R * 1.05} ry={R * 0.45} fill={`url(#${prefix}-shadow)`} />

      {selected && (
        <circle r={R + 2} fill="none" stroke={KIT.highlight} strokeWidth={0.5} strokeDasharray="1.6 1.1" opacity={0.9}>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
        </circle>
      )}

      {/* The shirt, its collar and a soft light from above */}
      <g transform={`scale(${SHIRT_SCALE}) translate(-20 -21)`}>
        <path
          d={SHIRT_PATH}
          fill={shirt}
          stroke={selected ? KIT.highlight : "#ffffff"}
          strokeWidth={selected ? 2.6 : 1.3}
          strokeLinejoin="round"
        />
        <path d={SHIRT_PATH} fill={`url(#${prefix}-gloss)`} opacity={0.55} />
        <path d="M13 4 Q20 9.5 27 4" fill="none" stroke={keeper ? "#1d1d1f" : "#ffffff"} strokeWidth={1.6} />
      </g>

      {badge && (
        <text
          y={1.75}
          textAnchor="middle"
          fontSize={badge.length > 1 ? 3.6 : 4}
          fontWeight={800}
          fill={ink}
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {badge}
        </text>
      )}

      {name && (
        <g transform={`translate(0 ${nameAbove ? -(R + 3.2) : R + 3.6})`}>
          <rect
            x={-pillW / 2}
            y={-2.1}
            width={pillW}
            height={3.3}
            rx={1.65}
            fill={selected ? KIT.highlight : "rgba(29,29,31,0.8)"}
          />
          <text y={0.35} textAnchor="middle" fontSize={2.5} fontWeight={700} fill={selected ? "#1d1d1f" : "#ffffff"}>
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
