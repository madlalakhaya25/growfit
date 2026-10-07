"use client";

import { useId, useState } from "react";
import { useBoardPlaybackStore } from "@/store/boardPlaybackStore";
import { totalDurationMs, type Frame } from "@/lib/board-model";
import {
  clampStepDuration, durationChoices, formatSeconds, stepDurationMs, stepIndexAt, stepStartTimes,
} from "@/lib/board-timeline";

export interface StepTimelineProps {
  /** Preview the move at `ms` without touching the live board. */
  scrubTo: (ms: number) => void;
  /** Leave the preview and go back to the editable board. */
  endScrub: () => void;
  /** Put the board at a step so the coach can edit it. */
  gotoFrame: (i: number) => void;
  setFrameDuration: (i: number, ms: number) => void;
  /** Push an undo entry before a change. */
  snapshot: () => void;
}

interface StepChipProps {
  index: number;
  frame: Frame;
  selected: boolean;
  current: boolean;
  disabled: boolean;
  onPick: (i: number) => void;
}

function StepChip({ index, frame, selected, current, disabled, onPick }: Readonly<StepChipProps>) {
  const tone = selected ? "border-primary bg-card shadow" : "border-transparent bg-secondary";
  return (
    <li className="shrink-0">
      <button
        type="button"
        onClick={() => onPick(index)}
        disabled={disabled}
        aria-pressed={selected}
        aria-current={current ? "step" : undefined}
        className={`flex h-11 sm:h-9 min-w-14 flex-col items-center justify-center rounded-[8px] border px-2.5 text-xs leading-tight disabled:opacity-50 ${tone}`}
      >
        <span className={current ? "font-semibold text-primary" : "font-medium"}>Step {index + 1}</span>
        <span className="text-xs text-muted-foreground">
          {index === 0 ? "Start" : formatSeconds(stepDurationMs(frame))}
        </span>
      </button>
    </li>
  );
}

interface DurationPickerProps {
  index: number;
  frame: Frame;
  disabled: boolean;
  onChange: (ms: number) => void;
}

function DurationPicker({ index, frame, disabled, onChange }: Readonly<DurationPickerProps>) {
  const id = useId();
  if (index === 0) {
    return <p className="text-xs text-muted-foreground">Step 1 is where everyone starts.</p>;
  }
  const current = stepDurationMs(frame);
  return (
    <div className="flex items-center gap-2 text-xs">
      <label htmlFor={id} className="text-muted-foreground">Step {index + 1} takes</label>
      <select
        id={id}
        value={current}
        disabled={disabled}
        onChange={(e) => onChange(clampStepDuration(Number(e.target.value)))}
        className="h-11 sm:h-8 rounded-md border border-border bg-card px-2 text-sm disabled:opacity-50"
      >
        {durationChoices(current).map((ms) => (
          <option key={ms} value={ms}>{formatSeconds(ms)}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * The step timeline under the board: one chip per step, a slider that
 * scrubs smoothly through the whole move, and the selected step's duration.
 * Only shows once there are two steps — one step is nothing to play.
 */
export function StepTimeline({ scrubTo, endScrub, gotoFrame, setFrameDuration, snapshot }: Readonly<StepTimelineProps>) {
  const { frames, playing, scrubMs, setScrubMs, recording } = useBoardPlaybackStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sliderId = useId();
  if (frames.length < 2) return null;

  const total = totalDurationMs(frames);
  const starts = stepStartTimes(frames);
  const at = Math.min(scrubMs, total);
  const currentIdx = stepIndexAt(frames, at);
  const selectedIdx = frames.findIndex((f) => f.id === selectedId);
  const busy = playing || recording;

  function pick(i: number) {
    setSelectedId(frames[i].id);
    setScrubMs(starts[i]);
    gotoFrame(i);
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-card p-3 shadow-sm" data-testid="step-timeline">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={sliderId} className="text-xs font-medium">Scrub through the move</label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatSeconds(at)} / {formatSeconds(total)}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={total}
        step={10}
        value={at}
        onChange={(e) => scrubTo(Number(e.target.value))}
        onPointerUp={endScrub}
        onBlur={endScrub}
        disabled={busy}
        className="h-11 sm:h-6 w-full accent-primary disabled:opacity-50"
      />
      <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Steps">
        {frames.map((f, i) => (
          <StepChip
            key={f.id}
            index={i}
            frame={f}
            selected={i === selectedIdx}
            current={i === currentIdx}
            disabled={busy}
            onPick={pick}
          />
        ))}
      </ol>
      {selectedIdx >= 0 && (
        <DurationPicker
          index={selectedIdx}
          frame={frames[selectedIdx]}
          disabled={busy}
          onChange={(ms) => { snapshot(); setFrameDuration(selectedIdx, ms); }}
        />
      )}
    </div>
  );
}
