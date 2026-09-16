import type { Pitch, PitchMarking } from "@/lib/board-model";

/**
 * Paints a Pitch's background and markings as SVG. Shared by the
 * interactive board and every read-only viewer so a new Pitch (see
 * lib/board-model.ts) only has to be described once, declaratively, rather
 * than hand-drawn again in each renderer.
 */
export function PitchLayer({ pitch, stripeId }: { pitch: Pitch; stripeId: string }) {
  return (
    <>
      <defs>
        <pattern id={stripeId} width={pitch.w} height={pitch.h / 12} patternUnits="userSpaceOnUse">
          <rect width={pitch.w} height={pitch.h / 12} fill="#15803d" />
          <rect width={pitch.w} height={pitch.h / 24} fill="#166f36" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={pitch.w} height={pitch.h} fill={`url(#${stripeId})`} />
      <g stroke="rgba(255,255,255,0.55)" strokeWidth={0.5} fill="none">
        {pitch.markings.map((m, i) => <Marking key={i} m={m} pitch={pitch} />)}
      </g>
    </>
  );
}

function Marking({ m, pitch }: { m: PitchMarking; pitch: Pitch }) {
  switch (m.kind) {
    case "rect":
      return <rect x={m.x} y={m.y} width={m.w} height={m.h} rx={1} />;
    case "circle":
      return <circle cx={m.cx} cy={m.cy} r={m.r} />;
    case "dot":
      return <circle cx={m.cx} cy={m.cy} r={m.r} fill="rgba(255,255,255,0.55)" />;
    case "line":
      return <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} />;
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
