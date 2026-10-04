"use client";

import { useEffect, useState } from "react";
import type { MatchFormat } from "@/lib/playing-time";
import { createLiveState, parseLiveState, storageKey, type LiveConfig, type LiveState } from "@/lib/playing-time-live";
import { PlanSetup } from "./plan-setup";
import { LiveMatch } from "./live-match";

export interface PlannerPlayer {
  id: string;
  name: string;
  isKeeper: boolean;
  unavailable: boolean;
}

interface MinutesPlannerProps {
  fixtureId: string;
  players: PlannerPlayer[];
  defaultSelected: string[];
  defaultFormat: MatchFormat;
}

function readStored(key: string): LiveState | null {
  try {
    return parseLiveState(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStored(key: string, state: LiveState | null) {
  try {
    if (state) window.localStorage.setItem(key, JSON.stringify(state));
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode): the match still runs, it just won't survive a reload */
  }
}

/**
 * Plan first, then run the match. A match in progress lives in localStorage,
 * keyed by fixture, so a reload or a locked phone picks up where it left off.
 */
export function MinutesPlanner({ fixtureId, players, defaultSelected, defaultFormat }: Readonly<MinutesPlannerProps>) {
  const key = storageKey(fixtureId);
  const [live, setLive] = useState<LiveState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stored = readStored(key);
    // Deferred so the first render matches the server's (no stored match yet).
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLive(stored);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [key]);

  const update = (next: LiveState | null) => {
    setLive(next);
    writeStored(key, next);
  };

  if (!loaded) return <div className="h-40 animate-pulse rounded-2xl bg-secondary" aria-hidden="true" />;

  if (live) {
    return <LiveMatch fixtureId={fixtureId} players={players} state={live} onChange={update} />;
  }

  return (
    <PlanSetup
      players={players}
      defaultSelected={defaultSelected}
      defaultFormat={defaultFormat}
      onStart={(config: LiveConfig) => update(createLiveState(config))}
    />
  );
}
