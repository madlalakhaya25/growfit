import type { ComponentProps } from "react";
import type { Pitch, Shape, Token } from "@/lib/board-model";
import { PitchLayer } from "@/components/tactics/pitch-layer";
import { TokenDefs, TokenGlyph } from "@/components/tactics/token-glyph";
import { ShapeDefs, ShapeGlyph } from "@/components/tactics/shape-glyph";
import { EquipmentLayer } from "@/components/tactics/equipment-layer";

/**
 * The one read-only picture of a board: pitch, shapes, equipment, tokens, in
 * that paint order. The shared play viewer and the drill diagram both draw
 * through it, so a change to how a board looks is made once. `prefix` keeps
 * every gradient and pattern id unique when several scenes share a page.
 */
export function BoardScene({
  pitch, tokens, shapes, objects, prefix, themeId, label,
}: Readonly<{
  pitch: Pitch;
  tokens: Token[];
  shapes: Shape[];
  objects: ComponentProps<typeof EquipmentLayer>["objects"];
  prefix: string;
  themeId?: ComponentProps<typeof PitchLayer>["themeId"];
  label?: string;
}>) {
  return (
    <svg
      viewBox={`0 0 ${pitch.w} ${pitch.h}`}
      className="h-full w-full select-none"
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      <ShapeDefs prefix={prefix} />
      <PitchLayer pitch={pitch} stripeId={`${prefix}-stripe`} themeId={themeId} />
      <TokenDefs prefix={`${prefix}-tok`} />
      {shapes.map((sh) => <ShapeGlyph key={sh.id} sh={sh} prefix={prefix} tokens={tokens} />)}
      <EquipmentLayer objects={objects} />
      {tokens.map((tok) => (
        <g key={tok.id} transform={`translate(${tok.x} ${tok.y})`}>
          <TokenGlyph tok={tok} prefix={`${prefix}-tok`} />
        </g>
      ))}
    </svg>
  );
}
