"use client";

import { ChevronDown, ChevronUp, Copy, Film, Play, Plus, Square, Trash2, Video } from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import { useBoardSetupStore } from "@/store/boardSetupStore";
import { useBoardPlaybackStore } from "@/store/boardPlaybackStore";
import { getPitch, totalDurationMs, DEFAULT_FRAME_DURATION_MS } from "@/lib/board-model";

/**
 * The board's "Play sequence" card: capture/play/stop/record/clear, the
 * scrub bar, and the frame timeline itself (reorder/goto/duration/set/
 * insert/duplicate/delete per step). Second panel extracted out of
 * tactical-board.tsx (docs/BACKLOG.md 3.3), covering the plan's item (c)
 * — though NOT paired with the keyboard-shortcut wiring the plan
 * suggested pairing it with: that `useEffect` renders no JSX of its own
 * and reads/writes `mode` (tool selection, unrelated local state used
 * everywhere else in tactical-board.tsx too), so moving it here would add
 * a hidden side effect to a component that otherwise only renders — left
 * in tactical-board.tsx, documented in this item's BACKLOG.md Shipped
 * note.
 *
 * `frames`/`playing`/`scrubMs`/`scrubbing`/`recording` come straight from
 * boardPlaybackStore, `pitchId` from boardSetupStore, `state.tokens.length`
 * from boardStore — all read directly via their hooks, no props needed.
 * Every handler function stays a prop: they're tightly coupled to
 * tactical-board.tsx's own undo-history refs (`snapshot`/past/future),
 * the RAF playback loop (`rafRef`), and the canvas video recorder
 * (`svgRef`) — none of that imperative, ref-heavy machinery moved as part
 * of this state-focused refactor, matching the plan's own instruction to
 * leave pointer/drag/coordinate-transform code untouched.
 */
export interface AnimationPanelProps {
  captureFrame: () => void;
  stopPlayback: () => void;
  playAnimation: () => void;
  recordAnimation: () => void;
  snapshot: () => void;
  scrubTo: (ms: number) => void;
  endScrub: () => void;
  gotoFrame: (i: number) => void;
  setFrameDuration: (i: number, ms: number) => void;
  updateFrame: (i: number) => void;
  insertFrameAfter: (i: number) => void;
  duplicateFrame: (i: number) => void;
  deleteFrame: (i: number) => void;
  moveFrame: (i: number, dir: -1 | 1) => void;
}

export function AnimationPanel({
  captureFrame, stopPlayback, playAnimation, recordAnimation, snapshot, scrubTo, endScrub,
  gotoFrame, setFrameDuration, updateFrame, insertFrameAfter, duplicateFrame, deleteFrame, moveFrame,
}: AnimationPanelProps) {
  const { state } = useBoardStore();
  const { pitchId } = useBoardSetupStore();
  const { frames, setFrames, playing, scrubMs, scrubbing, recording } = useBoardPlaybackStore();
  const pitch = getPitch(pitchId);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Film className="size-3.5 text-primary" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Play sequence
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Draw runs and passes and press Play — the players follow your arrows. For finer control, capture steps by hand.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={captureFrame} disabled={playing} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50">
          <Plus className="size-3" aria-hidden="true" /> Capture step
        </button>
        {playing ? (
          <button type="button" onClick={stopPlayback} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground">
            <Square className="size-3" aria-hidden="true" /> Stop
          </button>
        ) : (
          <button type="button" onClick={() => playAnimation()} disabled={state.tokens.length === 0} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            <Play className="size-3" aria-hidden="true" /> Play
          </button>
        )}
        <button
          type="button"
          onClick={recordAnimation}
          disabled={state.tokens.length === 0 || playing || recording || !pitch.supportsFormations}
          title={pitch.supportsFormations ? "Record the sequence as a video" : "Video recording needs the full pitch"}
          className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
        >
          <Video className="size-3 text-primary" aria-hidden="true" />
          {recording ? "Recording…" : "Record"}
        </button>
        {frames.length > 0 && (
          <button
            type="button"
            // Frame edits are now folded into the same undo/redo history as
            // tokens/shapes/objects (see snapshot()), so this is one Undo
            // away like every other destructive action on the board — no
            // separate confirm needed.
            onClick={() => { snapshot(); setFrames([]); }}
            disabled={playing || recording}
            className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>

      {frames.length >= 2 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={totalDurationMs(frames)}
              step={10}
              value={scrubMs}
              onChange={(e) => scrubTo(Number(e.target.value))}
              onPointerUp={endScrub}
              disabled={playing}
              aria-label="Scrub the sequence"
              className="flex-1 accent-primary disabled:opacity-50"
            />
            {/* A pointer drag ends preview on release (onPointerUp above),
                but arrow-key/Home/End interaction with the slider never
                fires a pointer event at all — without this, a keyboard
                user had no way back to the live, editable board once
                they'd touched the scrub bar. */}
            {scrubbing && (
              <button
                type="button"
                onClick={endScrub}
                className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted"
              >
                Done previewing
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {scrubbing ? "Previewing — drag to scrub, editing a pose needs Step ▸ below." : "Drag to preview the sequence at any point."}
          </p>
        </div>
      )}

      {frames.length === 0 ? (
        <p className="text-xs text-muted-foreground">No steps captured yet.</p>
      ) : (
        <ol className="space-y-1">
          {frames.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/50 p-1.5">
              <div className="flex flex-col">
                <button type="button" onClick={() => moveFrame(i, -1)} disabled={playing || i === 0} title="Move earlier" className="rounded px-0.5 hover:bg-muted disabled:opacity-30">
                  <ChevronUp className="size-3" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveFrame(i, 1)} disabled={playing || i === frames.length - 1} title="Move later" className="rounded px-0.5 hover:bg-muted disabled:opacity-30">
                  <ChevronDown className="size-3" aria-hidden="true" />
                </button>
              </div>
              <button type="button" onClick={() => gotoFrame(i)} disabled={playing} className="flex-1 min-w-[4rem] rounded-md border border-border bg-background px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50">
                Step {i + 1}
              </button>
              {i > 0 && (
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={f.durationMs ?? DEFAULT_FRAME_DURATION_MS}
                    onChange={(e) => setFrameDuration(i, Number(e.target.value))}
                    disabled={playing}
                    aria-label={`Step ${i + 1} duration in milliseconds`}
                    className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[10px] disabled:opacity-50"
                  />
                  ms
                </label>
              )}
              <button type="button" onClick={() => updateFrame(i)} disabled={playing} title="Update this step to the current board" className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] hover:bg-muted disabled:opacity-50">Set</button>
              <button type="button" onClick={() => insertFrameAfter(i)} disabled={playing} title="Insert the current board as a new step after this one" className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] hover:bg-muted disabled:opacity-50">
                <Plus className="size-3" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => duplicateFrame(i)} disabled={playing} title="Duplicate step" className="rounded-md border border-border bg-background px-1.5 py-1 hover:bg-muted disabled:opacity-50">
                <Copy className="size-3" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => deleteFrame(i)} disabled={playing} title="Delete step" className="rounded-md border border-border bg-background px-2 py-2 sm:py-1 hover:bg-muted disabled:opacity-50">
                <Trash2 className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
