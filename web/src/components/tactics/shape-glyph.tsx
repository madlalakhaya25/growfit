import {
  DRAW_COLORS, SHAPE_STROKE, arrowPath, arrowSpine, polyPath, pressMarks, resolveSpotlightCenter,
  shapeColor, shapeWidth, wavyPoints, type Shape, type Token,
} from "@/lib/board-model";
import { ArrowMarkers, arrowMarkerUrl } from "@/components/tactics/arrow-markers";

// One renderer for every drawn shape, shared by the interactive board
// (tactical-board.tsx) and the read-only shared view (play-viewer.tsx), so a
// curved run, a shot, a pressing line or a hatched zone looks the same to
// the player opening a shared play as it did to the coach drawing it.

const HALO = "rgba(15,23,42,0.55)";
const HATCH_COLORS = [...new Set([...DRAW_COLORS.map((c) => c.value), SHAPE_STROKE.zone])];
const hatchId = (prefix: string, color: string) =>
  `${prefix}-hatch-${(HATCH_COLORS.includes(color.toLowerCase()) ? color.toLowerCase() : SHAPE_STROKE.zone).replace("#", "")}`;

/** Arrow heads and zone hatch patterns — render once inside the <svg>. */
export function ShapeDefs({ prefix }: { prefix: string }) {
  return (
    <>
      <ArrowMarkers prefix={`${prefix}-arrow`} />
      <defs>
        {HATCH_COLORS.map((c) => (
          <pattern key={c} id={hatchId(prefix, c)} width={2.6} height={2.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={2.6} height={2.6} fill={c} fillOpacity={0.1} />
            <line x1={0} y1={0} x2={0} y2={2.6} stroke={c} strokeWidth={0.9} strokeOpacity={0.75} />
          </pattern>
        ))}
      </defs>
    </>
  );
}

export function ShapeGlyph({
  sh, prefix, tokens, isDraft = false, onPointerDown, cursor,
}: {
  sh: Shape;
  prefix: string;
  /** For spotlights, which follow the player they're bound to. */
  tokens: Pick<Token, "playerId" | "x" | "y">[];
  isDraft?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  cursor?: string;
}) {
  const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
  if (!a) return null;
  const color = shapeColor(sh);
  const w = shapeWidth(sh);
  const g = { opacity: isDraft ? 0.75 : 1, onPointerDown, style: cursor ? { cursor } : undefined };
  const line = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (sh.kind === "text") {
    return (
      <text
        x={a.x} y={a.y} fontSize={3.6} fontWeight={700} fill={color} textAnchor="middle"
        onPointerDown={onPointerDown}
        style={{ cursor, paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: 0.5 }}
      >
        {sh.text}
      </text>
    );
  }

  if (sh.kind === "zone") {
    return (
      <g {...g}>
        <path
          d={`${polyPath(sh.pts)} Z`}
          fill={sh.fill === "hatch" ? `url(#${hatchId(prefix, color)})` : color}
          fillOpacity={sh.fill === "hatch" ? 1 : 0.2}
          stroke={color} strokeWidth={Math.max(0.5, w * 0.55)} strokeDasharray="2 1.2" strokeLinejoin="round"
        />
      </g>
    );
  }

  if (sh.kind === "spotlight") {
    const c = resolveSpotlightCenter(sh, tokens) ?? a;
    const r = isDraft && b ? Math.max(4, Math.hypot(b.x - a.x, b.y - a.y)) : (sh.radius ?? 8);
    return (
      <g {...g}>
        <circle cx={c.x} cy={c.y} r={r} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={w * 0.8} strokeDasharray="1.5 1.2" />
      </g>
    );
  }

  if (sh.kind === "free") {
    const d = polyPath(sh.pts);
    return (
      <g {...g}>
        <path d={d} {...line} stroke={HALO} strokeWidth={w + 0.9} />
        <path d={d} {...line} stroke={color} strokeWidth={w} />
      </g>
    );
  }

  if (!b) return null;
  // Arrows: run / pass / dribble / shot / press.
  const spine = arrowSpine(a, b, sh.curve);
  const d = sh.kind === "dribble" ? polyPath(wavyPoints(spine)) : arrowPath(a, b, sh.curve);
  const head = arrowMarkerUrl(`${prefix}-arrow`, color);
  // An invisible fat copy underneath: thin lines are otherwise almost
  // impossible to hit with a finger when erasing.
  const hit = <path d={d} fill="none" stroke="transparent" strokeWidth={w + 3.5} />;

  if (sh.kind === "press") {
    const { ticks, bar } = pressMarks(spine, w);
    const marks = [...ticks, bar].map(([p, q]) => `M${p.x.toFixed(2)},${p.y.toFixed(2)} L${q.x.toFixed(2)},${q.y.toFixed(2)}`).join(" ");
    return (
      <g {...g}>
        {hit}
        <path d={`${d} ${marks}`} {...line} stroke={HALO} strokeWidth={w + 0.9} />
        <path d={d} {...line} stroke={color} strokeWidth={w} />
        <path d={marks} {...line} stroke={color} strokeWidth={w * 0.9} />
      </g>
    );
  }

  if (sh.kind === "shot") {
    const sw = w * 1.7;
    return (
      <g {...g}>
        {hit}
        <path d={d} {...line} stroke={HALO} strokeWidth={sw + 0.9} />
        <path d={d} {...line} stroke={color} strokeWidth={sw} />
        <path d={d} {...line} stroke="#ffffff" strokeOpacity={0.85} strokeWidth={sw * 0.28} />
        {/* Head carried by an invisible line of ordinary weight: markers
            scale with stroke width, and at the shot's width it's huge. */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={w * 1.25} markerEnd={head} />
      </g>
    );
  }

  return (
    <g {...g}>
      {hit}
      <path d={d} {...line} stroke={HALO} strokeWidth={w + 0.9} strokeDasharray={sh.kind === "pass" ? "2.4 1.6" : undefined} />
      <path d={d} {...line} stroke={color} strokeWidth={w} strokeDasharray={sh.kind === "pass" ? "2.4 1.6" : undefined} markerEnd={head} />
    </g>
  );
}
