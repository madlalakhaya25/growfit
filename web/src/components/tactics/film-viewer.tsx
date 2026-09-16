import { dribblePath, polyPath, shapeColor, shapeWidth, type Shape } from "@/lib/board-model";

/** Read-only mirror of FilmBoard's saved `data` shape — see
 * components/tactics/film-board.tsx. */
export interface FilmViewerData {
  surface: "film";
  frameImage?: string;
  frameW?: number;
  frameH?: number;
  shapes?: Shape[];
}

/**
 * The player-facing view of a video/still telestration. Unlike PlayViewer
 * there is nothing to animate — a film breakdown is one annotated still,
 * not a sequence of positions — so this is intentionally a much simpler,
 * static render.
 */
export function FilmViewer({ data }: { data: FilmViewerData }) {
  const w = data.frameW ?? 1280;
  const h = data.frameH ?? 720;
  const shapes = data.shapes ?? [];

  if (!data.frameImage) {
    return <p className="text-sm text-muted-foreground">This breakdown has no image to show.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-border" style={{ aspectRatio: `${w} / ${h}` }}>
        <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full select-none">
          <defs>
            <marker id="fv-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
            </marker>
          </defs>
          <image href={data.frameImage} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
          {shapes.map((sh) => {
            const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
            if (!a) return null;
            const stroke = shapeColor(sh);
            const common = { stroke, strokeWidth: shapeWidth(sh) * (w / 100), fill: "none", strokeLinecap: "round" as const };
            if (sh.kind === "text") {
              const size = w * 0.03;
              return (
                <text key={sh.id} x={a.x} y={a.y} fontSize={size} fill={stroke} fontWeight="bold"
                  style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: size * 0.15 }}>
                  {sh.text}
                </text>
              );
            }
            if (!b) return null;
            if (sh.kind === "free") return <path key={sh.id} d={polyPath(sh.pts)} {...common} />;
            if (sh.kind === "zone") return <path key={sh.id} d={polyPath(sh.pts) + " Z"} {...common} fill={stroke} fillOpacity={0.18} />;
            if (sh.kind === "dribble") return <path key={sh.id} d={dribblePath(a.x, a.y, b.x, b.y)} markerEnd="url(#fv-arrow)" {...common} />;
            return (
              <line key={sh.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                strokeDasharray={sh.kind === "pass" ? `${w * 0.03} ${w * 0.02}` : undefined}
                markerEnd="url(#fv-arrow)" {...common} />
            );
          })}
        </svg>
      </div>
    </div>
  );
}
