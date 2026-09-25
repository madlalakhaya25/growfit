import type { Pitch, PitchMarking } from "@/lib/board-model";
import { getPitchTheme, type PitchTheme } from "@/lib/pitch-themes";

/**
 * Paints a Pitch's background and markings as SVG. Shared by the
 * interactive board and every read-only viewer so a new Pitch (see
 * lib/board-model.ts) only has to be described once, declaratively, rather
 * than hand-drawn again in each renderer. How it's painted — grass, lines,
 * light — comes from a theme (lib/pitch-themes.ts).
 *
 * Grass, bottom to top: mown stripes; a fine blade texture; worn patches in
 * the goalmouths and centre circle; the light (sun from the top, or four
 * floodlight pools); a vignette. The blade texture is an feTurbulence noise
 * inside a small pattern tile — the browser rasterises one tile and repeats
 * it, so the texture costs nothing per frame while players are dragged.
 *
 * Lines are drawn twice — a wide faint pass then the crisp one — because
 * chalk on grass has a soft edge; a pure vector line reads as a diagram.
 *
 * All ids derive from `stripeId` so two boards on one page (board +
 * viewer) never share a def.
 */
export function PitchLayer({ pitch, stripeId, themeId }: { pitch: Pitch; stripeId: string; themeId?: string | null }) {
  const theme = getPitchTheme(themeId);
  const id = (s: string) => `${stripeId}-${s}`;
  // Real pitches are mown in bands roughly 5m wide: ~20 down a full pitch.
  const bands = Math.max(6, Math.round(pitch.h / 7.5));
  const bandH = pitch.h / bands;
  const goals = pitch.markings.filter((m) => m.kind === "goal");
  const circles = pitch.markings.filter((m) => m.kind === "circle");

  return (
    <>
      <defs>
        <pattern id={id("stripe")} width={pitch.w} height={bandH * 2} patternUnits="userSpaceOnUse">
          <rect width={pitch.w} height={bandH * 2} fill={theme.stripes[0]} />
          <rect y={bandH} width={pitch.w} height={bandH} fill={theme.stripes[1]} />
        </pattern>
        {theme.texture > 0 && (
          <>
            {/* Anisotropic noise: stretched along the length, like blades
                laid down by the mower. */}
            <filter id={id("blades")} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
              <feTurbulence type="fractalNoise" baseFrequency="2.2 0.55" numOctaves={2} seed={7} stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0.08  0 0 0 0 0  0 0 0 -1.6 1.05" />
            </filter>
            <pattern id={id("texture")} width={12} height={12} patternUnits="userSpaceOnUse">
              <rect width={12} height={12} filter={`url(#${id("blades")})`} />
            </pattern>
          </>
        )}
        <radialGradient id={id("wear")}>
          <stop offset="0" stopColor="#b8b27a" stopOpacity={0.3} />
          <stop offset="0.6" stopColor="#8f9a5a" stopOpacity={0.12} />
          <stop offset="1" stopColor="#8f9a5a" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id("sun")} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#fffbe6" stopOpacity={0.1} />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.1} />
        </linearGradient>
        <radialGradient id={id("flood")}>
          <stop offset="0" stopColor="#f8fbff" stopOpacity={0.2} />
          <stop offset="1" stopColor="#f8fbff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={id("vignette")} cx="50%" cy="50%" r="75%">
          <stop offset="0.55" stopColor="#000000" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={theme.vignette} />
        </radialGradient>
        <pattern id={id("net")} width={1} height={1} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill="rgba(15,23,42,0.3)" />
          <path d="M0 0 L1 1 M1 0 L0 1" stroke={theme.net} strokeWidth={0.12} />
        </pattern>
      </defs>

      <g pointerEvents="none">
        <rect width={pitch.w} height={pitch.h} fill={`url(#${id("stripe")})`} />
        {theme.texture > 0 && <rect width={pitch.w} height={pitch.h} fill={`url(#${id("texture")})`} opacity={theme.texture} />}
        {theme.wear && <Wear pitch={pitch} goals={goals} circles={circles} gradId={id("wear")} />}
        {theme.lighting === "sun" && <rect width={pitch.w} height={pitch.h} fill={`url(#${id("sun")})`} />}
        {theme.lighting === "floodlights" && (
          <>
            <rect width={pitch.w} height={pitch.h} fill="#020617" opacity={0.18} />
            {[[0, 0], [pitch.w, 0], [0, pitch.h], [pitch.w, pitch.h]].map(([cx, cy]) => (
              <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={pitch.w * 0.75} ry={pitch.h * 0.5} fill={`url(#${id("flood")})`} />
            ))}
          </>
        )}
        {theme.vignette > 0 && <rect width={pitch.w} height={pitch.h} fill={`url(#${id("vignette")})`} />}
      </g>

      {theme.lineGlow > 0 && (
        <g stroke={theme.line} strokeOpacity={theme.lineGlow} strokeWidth={1.3} fill="none" strokeLinecap="round" pointerEvents="none">
          {pitch.markings.filter((m) => m.kind !== "goal" && m.kind !== "grid" && m.kind !== "dot").map((m) => (
            <Marking key={markingKey(m)} m={m} pitch={pitch} theme={theme} netId={id("net")} />
          ))}
        </g>
      )}
      <g stroke={theme.line} strokeOpacity={theme.lineOpacity} strokeWidth={0.42} fill="none" strokeLinecap="round" pointerEvents="none">
        {pitch.markings.map((m) => <Marking key={markingKey(m)} m={m} pitch={pitch} theme={theme} netId={id("net")} />)}
      </g>
      <CornerFlags pitch={pitch} goals={goals} />
    </>
  );
}

/** Scuffed grass where play concentrates: in front of each goal and in the
 * centre circle — what makes a pitch read as played-on, not rendered. */
function Wear({ pitch, goals, circles, gradId }: { pitch: Pitch; goals: PitchMarking[]; circles: PitchMarking[]; gradId: string }) {
  return (
    <>
      {goals.map((g) => {
        const top = (g.y ?? 0) < pitch.h / 2;
        const cx = (g.x ?? 0) + (g.w ?? 0) / 2;
        return (
          <g key={markingKey(g)}>
            <ellipse cx={cx} cy={top ? 5 : pitch.h - 5} rx={9} ry={5} fill={`url(#${gradId})`} />
            <ellipse cx={cx} cy={top ? 16 : pitch.h - 16} rx={6} ry={4} fill={`url(#${gradId})`} opacity={0.7} />
          </g>
        );
      })}
      {circles.map((c) => (
        <ellipse key={markingKey(c)} cx={c.cx} cy={c.cy} rx={(c.r ?? 10) * 0.7} ry={(c.r ?? 10) * 0.55} fill={`url(#${gradId})`} opacity={0.8} />
      ))}
    </>
  );
}

/** A corner flag at each corner that has a goal line — a pitch that ends at
 * halfway (the half-pitch view) has no flags on that edge. */
function CornerFlags({ pitch, goals }: { pitch: Pitch; goals: PitchMarking[] }) {
  if (goals.length === 0) return null;
  const ends = goals.map((g) => ((g.y ?? 0) < pitch.h / 2 ? 2 : pitch.h - 2));
  return (
    <g pointerEvents="none">
      {ends.flatMap((y) =>
        [2, pitch.w - 2].map((x) => {
          const dir = x < pitch.w / 2 ? 1 : -1;
          return (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <line x1={0} y1={0} x2={0} y2={-2.6} stroke="#f8fafc" strokeWidth={0.22} />
              <path d={`M0 -2.6 L${1.5 * dir} -2.15 L0 -1.7 Z`} fill="#facc15" stroke="rgba(15,23,42,0.4)" strokeWidth={0.08} />
              <circle r={0.28} fill="#f8fafc" />
            </g>
          );
        })
      )}
    </g>
  );
}

/** A stable key from a marking's own geometry — markings have no ids, and
 * two markings never share a kind and position. */
function markingKey(m: PitchMarking): string {
  return [m.kind, m.x, m.y, m.w, m.h, m.cx, m.cy, m.r, m.x1, m.y1, m.x2, m.y2, m.d, m.spacing].join(":");
}

function Marking({ m, pitch, theme, netId }: { m: PitchMarking; pitch: Pitch; theme: PitchTheme; netId: string }) {
  switch (m.kind) {
    case "rect":
      return <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={0.3} />;
    case "circle":
      return <circle cx={m.cx} cy={m.cy} r={m.r} />;
    case "dot":
      return <circle cx={m.cx} cy={m.cy} r={m.r} fill={theme.line} fillOpacity={theme.lineOpacity} stroke="none" />;
    case "line":
      return <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />;
    case "path":
      return m.d ? <path d={m.d} /> : null;
    case "goal": {
      // Net behind the line, then the frame: posts and crossbar on the goal
      // line itself, drawn heavier than the chalk so the goal reads as an object.
      const x = m.x ?? 0, y = m.y ?? 0, w = m.w ?? 0, h = m.h ?? 0;
      const lineY = y < pitch.h / 2 ? y + h : y;
      return (
        <g>
          <rect x={x} y={y} width={w} height={h} rx={0.3} fill={`url(#${netId})`} stroke={theme.line} strokeOpacity={0.55} strokeWidth={0.2} />
          <line x1={x} y1={lineY} x2={x + w} y2={lineY} stroke={theme.line} strokeOpacity={1} strokeWidth={0.75} />
          <circle cx={x} cy={lineY} r={0.45} fill={theme.line} stroke="none" />
          <circle cx={x + w} cy={lineY} r={0.45} fill={theme.line} stroke="none" />
        </g>
      );
    }
    case "grid": {
      const spacing = m.spacing ?? 10;
      const lines: React.ReactNode[] = [];
      for (let x = spacing; x < pitch.w; x += spacing) {
        lines.push(<line key={`v${x}`} x1={x} y1={2} x2={x} y2={pitch.h - 2} strokeDasharray="1 1.5" strokeOpacity={0.4} />);
      }
      for (let y = spacing; y < pitch.h; y += spacing) {
        lines.push(<line key={`h${y}`} x1={2} y1={y} x2={pitch.w - 2} y2={y} strokeDasharray="1 1.5" strokeOpacity={0.4} />);
      }
      return <>{lines}</>;
    }
    default:
      return null;
  }
}
