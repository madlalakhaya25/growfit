import { useId } from "react";
import { getPitch } from "@/lib/board-model";
import { describeDiagram, type DrillDiagram } from "@/lib/drill-diagram";
import { PitchLayer } from "@/components/tactics/pitch-layer";
import { TokenDefs, TokenGlyph } from "@/components/tactics/token-glyph";
import { ShapeDefs, ShapeGlyph } from "@/components/tactics/shape-glyph";
import { EquipmentLayer } from "@/components/tactics/equipment-layer";

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
      <svg viewBox={`0 0 ${pitch.w} ${pitch.h}`} className="h-full w-full select-none" role="img" aria-label={describeDiagram(diagram)}>
        <ShapeDefs prefix={prefix} />
        <PitchLayer pitch={pitch} stripeId={`${prefix}-stripe`} />
        <TokenDefs prefix={`${prefix}-tok`} />
        {diagram.shapes.map((sh) => <ShapeGlyph key={sh.id} sh={sh} prefix={prefix} tokens={diagram.tokens} />)}
        <EquipmentLayer objects={diagram.objects} />
        {diagram.tokens.map((tok) => (
          <g key={tok.id} transform={`translate(${tok.x} ${tok.y})`}>
            <TokenGlyph tok={tok} prefix={`${prefix}-tok`} />
          </g>
        ))}
      </svg>
    </div>
  );
}
