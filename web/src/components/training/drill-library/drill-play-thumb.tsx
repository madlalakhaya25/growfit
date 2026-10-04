import { getPitch } from "@/lib/board-model";
import { BoardScene } from "@/components/tactics/board-scene";
import type { PlayData } from "@/components/tactics/play-viewer";

/**
 * A still of a saved board play, small enough for a list row: the play's
 * first pose, no animation — what the drill looks like when the cones go out.
 * `uid` keeps SVG gradient ids unique when many thumbs share a page.
 */
export function DrillPlayThumb({
  play,
  name,
  uid,
  size = "sm",
}: Readonly<{ play: PlayData; name: string; uid: string; size?: "sm" | "lg" }>) {
  const pitch = getPitch(play.pitchId);
  const box = size === "lg" ? "w-full max-w-[220px]" : "w-12";
  return (
    <div
      className={`${box} shrink-0 overflow-hidden rounded-[10px] border border-border bg-secondary`}
      style={{ aspectRatio: `${pitch.w} / ${pitch.h}` }}
    >
      <BoardScene
        pitch={pitch}
        tokens={play.tokens ?? []}
        shapes={play.shapes ?? []}
        objects={play.objects ?? []}
        prefix={`dl-${size}-${uid}`}
        themeId={play.pitchThemeId}
        label={`Diagram: ${name}`}
      />
    </div>
  );
}
