import type { Pitch, PitchMarking } from "@/lib/board-model";

/**
 * Paints a Pitch's background and markings as SVG. Shared by the
 * interactive board and every read-only viewer so a new Pitch (see
 * lib/board-model.ts) only has to be described once, declaratively, rather
 * than hand-drawn again in each renderer.
 *
 * The grass is three layers: mowed stripes, a soft top-down light falloff,
 * and a vignette that darkens the edges so the lines and tokens in the
 * middle read first. All ids derive from `stripeId` so two boards on one
 * page (board + viewer) never share a def.
 */
export function PitchLayer({ pitch, stripeId }: { pitch: Pitch; stripeId: string }) {
  const stripeH = pitch.h / 12;
  const lightId = `${stripeId}-light`;
  const vignetteId = `${stripeId}-vignette`;
  const netId = `${stripeId}-net`;
  return (
    <>
      <defs>
        <pattern id={stripeId} width={pitch.w} height={stripeH} patternUnits="userSpaceOnUse">
          <rect width={pitch.w} height={stripeH} fill="#1f8a45" />
          <rect width={pitch.w} height={stripeH / 2} fill="#1a7a3c" />
        </pattern>
        <linearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.07} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.08} />
        </linearGradient>
        <radialGradient id={vignetteId} cx="50%" cy="50%" r="75%">
          <stop offset="0.55" stopColor="#000000" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.35} />
        </radialGradient>
        <pattern id={netId} width={1} height={1} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill="rgba(15,23,42,0.35)" />
          <path d="M0 0 L1 1 M1 0 L0 1" stroke="rgba(255,255,255,0.45)" strokeWidth={0.12} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={pitch.w} height={pitch.h} fill={`url(#${stripeId})`} />
      <rect x={0} y={0} width={pitch.w} height={pitch.h} fill={`url(#${lightId})`} pointerEvents="none" />
      <rect x={0} y={0} width={pitch.w} height={pitch.h} fill={`url(#${vignetteId})`} pointerEvents="none" />
      <g
        stroke="rgba(255,255,255,0.82)"
        strokeWidth={0.45}
        fill="none"
        strokeLinecap="round"
        pointerEvents="none"
      >
        {pitch.markings.map((m, i) => <Marking key={i} m={m} pitch={pitch} netId={netId} />)}
      </g>
    </>
  );
}

function Marking({ m, pitch, netId }: { m: PitchMarking; pitch: Pitch; netId: string }) {
  switch (m.kind) {
    case "rect":
      return <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={0.4} />;
    case "circle":
      return <circle cx={m.cx} cy={m.cy} r={m.r} />;
    case "dot":
      return <circle cx={m.cx} cy={m.cy} r={m.r} fill="rgba(255,255,255,0.82)" stroke="none" />;
    case "line":
      return <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />;
    case "path":
      return m.d ? <path d={m.d} /> : null;
    case "goal":
      return (
        <rect
          x={m.x} y={m.y} width={m.w} height={m.h} rx={0.3}
          fill={`url(#${netId})`}
          stroke="#f8fafc"
          strokeWidth={0.55}
        />
      );
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
