import { EQUIPMENT_SPECS, type BoardObject } from "@/lib/board-model";

/**
 * Draws placed training equipment (cones, goals, ladders, …) as simple SVG
 * glyphs. One shape per kind, defined once against EQUIPMENT_SPECS so the
 * interactive board and every read-only viewer draw the same picture.
 */
export function EquipmentLayer({
  objects,
  onPointerDown,
}: {
  objects: BoardObject[];
  onPointerDown?: (e: React.PointerEvent, obj: BoardObject) => void;
}) {
  return (
    <>
      {objects.map((o) => {
        const spec = EQUIPMENT_SPECS[o.kind];
        return (
          <g
            key={o.id}
            transform={`translate(${o.x} ${o.y}) rotate(${o.rotation ?? 0})`}
            onPointerDown={onPointerDown ? (e) => onPointerDown(e, o) : undefined}
            style={{ cursor: onPointerDown ? "grab" : "default" }}
          >
            <EquipmentGlyph kind={o.kind} color={spec.color} w={spec.w} h={spec.h} />
          </g>
        );
      })}
    </>
  );
}

function EquipmentGlyph({ kind, color, w, h }: { kind: BoardObject["kind"]; color: string; w: number; h: number }) {
  switch (kind) {
    case "cone":
      return <path d={`M0,${-h / 2} L${w / 2},${h / 2} L${-w / 2},${h / 2} Z`} fill={color} stroke="#000" strokeWidth={0.2} strokeOpacity={0.4} />;
    case "flat-marker":
      return <ellipse rx={w / 2} ry={h / 4} fill={color} stroke="#000" strokeWidth={0.2} strokeOpacity={0.4} />;
    case "mannequin":
      return (
        <g fill={color} stroke="#000" strokeWidth={0.2} strokeOpacity={0.4}>
          <circle cy={-h / 2 + 1} r={1} />
          <rect x={-w / 2} y={-h / 2 + 2} width={w} height={h - 2} rx={0.6} />
        </g>
      );
    case "mini-goal":
    case "goal":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="none" stroke={color} strokeWidth={0.6} />;
    case "pole":
      return <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke={color} strokeWidth={0.6} strokeLinecap="round" />;
    case "ladder":
      return (
        <g stroke={color} strokeWidth={0.4}>
          <line x1={-w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} />
          <line x1={w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} />
          {Array.from({ length: Math.max(2, Math.round(h / 3)) }).map((_, i, arr) => {
            const y = -h / 2 + (i / (arr.length - 1)) * h;
            return <line key={i} x1={-w / 2} y1={y} x2={w / 2} y2={y} />;
          })}
        </g>
      );
    case "hurdle":
      return (
        <g stroke={color} strokeWidth={0.5}>
          <line x1={-w / 2} y1={0} x2={w / 2} y2={0} />
          <line x1={-w / 2} y1={-h / 2} x2={-w / 2} y2={h / 2} />
          <line x1={w / 2} y1={-h / 2} x2={w / 2} y2={h / 2} />
        </g>
      );
    case "ball-cluster":
      return (
        <g fill={color} stroke="#000" strokeWidth={0.15} strokeOpacity={0.4}>
          <circle cx={-w / 4} cy={0} r={w / 5} />
          <circle cx={w / 4} cy={0} r={w / 5} />
          <circle cx={0} cy={h / 4} r={w / 5} />
        </g>
      );
    case "bib":
      return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={0.4} fill={color} stroke="#000" strokeWidth={0.2} strokeOpacity={0.4} />;
    default:
      return null;
  }
}
