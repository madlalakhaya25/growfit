import type { Point, Token } from "@/lib/board-model";
import { zoneRect, ZONE_IDS } from "@/lib/board-analysis";
import type { LaneStatus, LinesReading, PassingLane, SpaceControl, ZoneCount } from "@/lib/board-overlays";

// The Phase 2 analysis overlays (lib/board-overlays.ts) drawn on the pitch.
// All pointer-transparent like TeamShapeLayer/ExploitLayer, so they never
// block dragging, and all plain SVG so the PNG export picks them up. Each
// layer's readout chip has its own row along the bottom-left so several
// layers can be on at once without their chips landing on each other
// (TeamShapeLayer's own chips sit top-left).

const US = "#38bdf8";
const THEM = "#f87171";

function Chip({ row, h, text, color }: { row: number; h: number; text: string; color: string }) {
  const w = text.length * 1.28 + 4;
  return (
    <g transform={`translate(3.5 ${h - 8 - row * 5})`}>
      <rect width={w} height={4} rx={2} fill="rgba(15,23,42,0.85)" />
      <circle cx={2.2} cy={2} r={0.9} fill={color} />
      <text x={3.8} y={2.95} fontSize={2.4} fontWeight={600} fill="#ffffff">{text}</text>
    </g>
  );
}

const LANE_STYLE: Record<LaneStatus, { color: string; dash?: string; opacity: number }> = {
  open: { color: "#4ade80", opacity: 0.95 },
  risky: { color: "#fbbf24", dash: "1.6 1", opacity: 0.9 },
  blocked: { color: "#f87171", dash: "0.8 1.2", opacity: 0.55 },
};

export function PassingLaneLayer({ lanes, h }: { lanes: PassingLane[]; h: number }) {
  if (lanes.length === 0) {
    return (
      <g pointerEvents="none" data-testid="lanes-layer">
        <Chip row={0} h={h} text="Passing lanes: put the ball at a player's feet" color="#4ade80" />
      </g>
    );
  }
  const open = lanes.filter((l) => l.status === "open");
  const forward = open.filter((l) => l.forward).length;
  // Blocked first so open lanes draw on top where they cross.
  const order: LaneStatus[] = ["blocked", "risky", "open"];
  return (
    <g pointerEvents="none" data-testid="lanes-layer">
      {order.flatMap((st) =>
        lanes.filter((l) => l.status === st).map((l) => {
          const s = LANE_STYLE[st];
          return (
            <line
              key={l.toId}
              x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
              stroke={s.color} strokeOpacity={s.opacity}
              strokeWidth={l.forward && st === "open" ? 0.9 : 0.6}
              strokeDasharray={s.dash}
              strokeLinecap="round"
            />
          );
        })
      )}
      <Chip row={0} h={h} text={`${open.length} open pass${open.length === 1 ? "" : "es"} · ${forward} forward`} color="#4ade80" />
    </g>
  );
}

export function SpaceControlLayer({ control, h }: { control: SpaceControl | null; h: number }) {
  if (!control) {
    return (
      <g pointerEvents="none" data-testid="space-layer">
        <Chip row={1} h={h} text="Space control: needs both teams on the pitch" color={US} />
      </g>
    );
  }
  const [att, mid] = control.thirdsPct;
  return (
    <g pointerEvents="none" data-testid="space-layer">
      {control.runs.map((r) => (
        <rect
          key={`${r.y.toFixed(2)}-${r.x1.toFixed(2)}`}
          x={r.x1} y={r.y} width={r.x2 - r.x1} height={control.cellH + 0.02}
          fill={r.side === "player" ? US : THEM}
          fillOpacity={0.22}
        />
      ))}
      <Chip row={1} h={h} text={`We own ${control.oursPct}% · midfield ${mid}% · final third ${att}%`} color={US} />
    </g>
  );
}

export function LinesLayer({
  lines, tokens, w, h,
}: {
  lines: LinesReading;
  tokens: Pick<Token, "id" | "x" | "y">[];
  w: number;
  h: number;
}) {
  const gaps = (g: number[]) => (g.length ? g.map((m) => `${Math.round(m)}m`).join(" · ") : "—");
  const offside = tokens.filter((t) => lines.offsideIds.includes(t.id));
  return (
    <g pointerEvents="none" data-testid="lines-layer">
      {lines.offsideY !== null && (
        <g>
          <line x1={2} y1={lines.offsideY} x2={w - 2} y2={lines.offsideY} stroke={THEM} strokeWidth={0.5} strokeDasharray="2 1.2" />
          <g transform={`translate(${w - 3} ${lines.offsideY - 2.6})`}>
            <rect x={-18.5} y={-2.1} width={18.5} height={3.8} rx={1.9} fill="rgba(15,23,42,0.85)" stroke={THEM} strokeWidth={0.3} />
            <text x={-9.25} y={0.75} textAnchor="middle" fontSize={2.4} fontWeight={700} fill="#ffffff">Offside line</text>
          </g>
        </g>
      )}
      {lines.ourLastLineY !== null && (
        <line x1={2} y1={lines.ourLastLineY} x2={w - 2} y2={lines.ourLastLineY} stroke={US} strokeOpacity={0.8} strokeWidth={0.4} strokeDasharray="2 1.2" />
      )}
      {offside.map((t: Point & { id: string }) => (
        // Tokens draw on top of this layer, so the ring sits well outside the
        // glyph and carries its own tag rather than relying on colour alone.
        <g key={t.id} transform={`translate(${t.x} ${t.y})`}>
          <circle r={6} fill="none" stroke={THEM} strokeWidth={0.8} strokeDasharray="1.4 0.8" />
          {/* Below the ring: a player beyond the line is nearer their goal,
              where their keeper and defenders sit above them. */}
          <rect x={-6} y={6.8} width={12} height={3.6} rx={1.8} fill={THEM} />
          <text y={9.4} textAnchor="middle" fontSize={2.3} fontWeight={800} fill="#ffffff">OFFSIDE</text>
        </g>
      ))}
      <Chip
        row={2} h={h} color={THEM}
        text={`Between lines — them ${gaps(lines.theirGapsM)} | us ${gaps(lines.ourGapsM)}${offside.length ? ` · ${offside.length} offside` : ""}`}
      />
    </g>
  );
}

export function ZoneCountLayer({ counts }: { counts: ZoneCount[] }) {
  const byZone = new Map(counts.map((c) => [c.zoneId, c]));
  return (
    <g pointerEvents="none" data-testid="numbers-layer">
      {ZONE_IDS.map((z) => {
        const r = zoneRect(z);
        return <rect key={z} x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.3} strokeDasharray="1.5 1.5" />;
      })}
      {ZONE_IDS.map((z) => {
        const c = byZone.get(z);
        if (!c) return null;
        const r = zoneRect(z);
        const diff = c.us - c.them;
        const color = diff >= 2 ? "#16a34a" : diff <= -2 ? "#dc2626" : "rgba(15,23,42,0.8)";
        const text = `${c.us}v${c.them}`;
        return (
          <g key={z} transform={`translate(${r.x + r.w / 2} ${r.y + 4})`}>
            <rect x={-4} y={-2.2} width={8} height={3.8} rx={1.9} fill={color} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={0.25} />
            <text y={0.6} textAnchor="middle" fontSize={2.5} fontWeight={700} fill="#ffffff">{text}</text>
          </g>
        );
      })}
    </g>
  );
}
