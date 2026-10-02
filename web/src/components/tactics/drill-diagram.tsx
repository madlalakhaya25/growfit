import { useId } from "react";
import { getPitch } from "@/lib/board-model";
import { describeDiagram, type DrillDiagram } from "@/lib/drill-diagram";
import { BoardScene } from "@/components/tactics/board-scene";

/**
 * A drill's layout, drawn read-only with the same pitch, shape, equipment and
 * token pieces as the shared play viewer so a diagram looks like the board it
 * could have been drawn on. Takes validated data only (validateDiagram).
 */
export function DrillDiagramView({ diagram }: Readonly<{ diagram: DrillDiagram }>) {
  // Every def id derives from this prefix, so several diagrams on one page
  // (one per drill) never share a gradient or pattern.
  const prefix = `dd${useId().replaceAll(":", "")}`;
  const pitch = getPitch(diagram.pitchId);
  return (
    <div
      className="mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-border"
      style={{ aspectRatio: `${pitch.w} / ${pitch.h}` }}
    >
      <BoardScene pitch={pitch} tokens={diagram.tokens} shapes={diagram.shapes} objects={diagram.objects} prefix={prefix} label={describeDiagram(diagram)} />
    </div>
  );
}
