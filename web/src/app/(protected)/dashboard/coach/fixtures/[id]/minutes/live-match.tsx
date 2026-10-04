"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Flag, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { buildRotation, formatClock } from "@/lib/playing-time";
import {
  confirmChange,
  endHalf,
  finishMatch,
  halfSeconds,
  isRunning,
  liveSeconds,
  nextChange,
  pauseClock,
  skipChange,
  startClock,
  startNextHalf,
  suggestedChange,
  undoChange,
  type Change,
  type LiveState,
} from "@/lib/playing-time-live";
import type { PlannerPlayer } from "./minutes-planner";
import { ChangePanel } from "./change-panel";
import { halfName } from "./plan-preview";
import { LiveMinutesList } from "./live-minutes-list";
import { FinishPanel } from "./finish-panel";

interface LiveMatchProps {
  fixtureId: string;
  players: PlannerPlayer[];
  state: LiveState;
  onChange: (next: LiveState | null) => void;
}

/** Re-render once a second so the clock and countdown move. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/** Buzz the phone once when a change falls due (where the phone can). */
function useDueBuzz(due: boolean, pointKey: string) {
  const buzzed = useRef<string | null>(null);
  useEffect(() => {
    if (!due || buzzed.current === pointKey) return;
    buzzed.current = pointKey;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate([300, 150, 300]); } catch { /* not allowed here */ }
    }
  }, [due, pointKey]);
}

/** Keep the screen awake while the clock runs, where the browser allows it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    navigator.wakeLock.request("screen").then(
      (l) => { if (released) void l.release(); else lock = l; },
      () => { /* refused: the screen may sleep, the clock still keeps time */ },
    );
    return () => { released = true; void lock?.release(); };
  }, [active]);
}

function ClockPanel({ state, now, onStartStop, onEndHalf, onNextHalf }: Readonly<{
  state: LiveState; now: number; onStartStop: () => void; onEndHalf: () => void; onNextHalf: () => void;
}>) {
  const running = isRunning(state);
  const secs = halfSeconds(state, now);
  const over = secs >= state.config.halfMinutes * 60;
  const isLastHalf = state.half >= state.config.halves;
  return (
    <Card className="space-y-3 p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {state.phase === "break" ? `${halfName(state.half)} over` : halfName(state.half)}
      </p>
      <p className="font-display text-6xl tabular-nums" aria-label="Match clock">{formatClock(secs)}</p>
      {over && state.phase === "playing" && <p className="text-sm font-medium text-warning">Time&apos;s up for this half</p>}
      {state.phase === "break" ? (
        <Button block size="lg" onClick={onNextHalf}>
          <Play className="size-5" aria-hidden="true" />
          Kick off {halfName(state.half + 1).toLowerCase()}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" variant={running ? "secondary" : "primary"} onClick={onStartStop}>
            {running ? <Pause className="size-5" aria-hidden="true" /> : <Play className="size-5" aria-hidden="true" />}
            {running ? "Pause" : "Start clock"}
          </Button>
          {state.phase === "playing" && (
            <Button size="lg" variant="outline" className="flex-1" onClick={onEndHalf}>
              <Flag className="size-5" aria-hidden="true" />
              {isLastHalf ? "Full time" : "Half-time"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** The live touchline screen: clock, the next change, everyone's minutes. */
export function LiveMatch({ fixtureId, players, state, onChange }: Readonly<LiveMatchProps>) {
  const now = useNow();
  const { confirm, dialog } = useConfirm();
  const [picked, setPicked] = useState<{ point: number; change: Change } | null>(null);
  const plan = buildRotation(state.config);
  const names = new Map(players.map((p) => [p.id, p.name]));
  const info = nextChange(state, plan, now);
  const suggestion = suggestedChange(state, plan, now);
  const change = picked?.point === state.nextPoint ? picked.change : suggestion;

  useDueBuzz(info.due, `${state.half}:${state.nextPoint}`);
  useWakeLock(isRunning(state));

  const apply = (next: LiveState) => {
    setPicked(null);
    onChange(next);
  };
  const toggle = (side: "off" | "on", id: string) => {
    const list = change[side].includes(id) ? change[side].filter((x) => x !== id) : [...change[side], id];
    setPicked({ point: state.nextPoint, change: { ...change, [side]: list } });
  };
  const startOver = async () => {
    const ok = await confirm({
      title: "Start over?",
      body: "This clears the clock and everyone's minutes for this match on this phone.",
      confirmLabel: "Start over",
      destructive: true,
    });
    if (ok) onChange(null);
  };

  if (state.phase === "done") {
    return <FinishPanel fixtureId={fixtureId} state={state} names={names} plan={plan} onClear={() => onChange(null)} />;
  }

  const bench = state.config.playerIds.filter((id) => !state.onPitch.includes(id));
  const secs = liveSeconds(state, now);

  return (
    <div className="space-y-4">
      <ClockPanel
        state={state}
        now={now}
        onStartStop={() => apply(isRunning(state) ? pauseClock(state, Date.now()) : startClock(state, Date.now()))}
        onEndHalf={() => apply(endHalf(state, Date.now()))}
        onNextHalf={() => apply(startNextHalf(state, Date.now(), plan))}
      />
      {state.phase !== "ready" && (
        <ChangePanel
          info={info}
          change={change}
          onPitch={state.onPitch}
          bench={bench}
          keeperId={plan.keeperId}
          names={names}
          canUndo={!!state.undo}
          onToggle={toggle}
          onConfirm={() => apply(confirmChange(state, change, plan, Date.now()))}
          onSkip={() => apply(skipChange(state, plan))}
          onUndo={() => apply(undoChange(state))}
        />
      )}
      <LiveMinutesList squad={state.config.playerIds} onPitch={state.onPitch} seconds={secs} planned={plan.minutes} names={names} />
      <div className="flex flex-wrap gap-2">
        {state.phase !== "ready" && (
          <Button variant="outline" className="flex-1" onClick={() => apply(finishMatch(state, Date.now()))}>
            <Flag aria-hidden="true" />
            Finish match now
          </Button>
        )}
        <Button variant="ghost" className="flex-1" onClick={startOver}>
          <RotateCcw aria-hidden="true" />
          Start over
        </Button>
      </div>
      {dialog}
    </div>
  );
}
