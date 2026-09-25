import { DRAW_COLORS } from "@/lib/board-model";

const markerId = (prefix: string, color: string) => `${prefix}-${color.replace("#", "")}`;

/**
 * One arrow-head marker per palette colour, so a sky-blue run ends in a
 * sky-blue head rather than the single yellow one every line used to share.
 * (`fill="context-stroke"` would do this with one marker, but the PNG
 * export rasterises through an <img>, where support is patchier.)
 */
export function ArrowMarkers({ prefix }: { prefix: string }) {
  return (
    <defs>
      {DRAW_COLORS.map((c) => (
        <marker
          key={c.value}
          id={markerId(prefix, c.value)}
          viewBox="0 0 10 10"
          refX={7}
          refY={5}
          markerWidth={4.5}
          markerHeight={4.5}
          orient="auto-start-reverse"
        >
          {/* Swept head: a notched back reads as an arrow at a glance
              rather than a triangle stuck on the end of the line. */}
          <path d="M0,0.5 L10,5 L0,9.5 L2.6,5 z" fill={c.value} stroke="rgba(15,23,42,0.55)" strokeWidth={0.6} strokeLinejoin="round" />
        </marker>
      ))}
    </defs>
  );
}

/** `url(#…)` for the head matching `color`, falling back to yellow. */
export function arrowMarkerUrl(prefix: string, color: string): string {
  const known = DRAW_COLORS.some((c) => c.value.toLowerCase() === color.toLowerCase());
  return `url(#${markerId(prefix, known ? color.toLowerCase() : DRAW_COLORS[0].value)})`;
}
