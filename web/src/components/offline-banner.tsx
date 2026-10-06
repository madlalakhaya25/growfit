"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser says it has a connection. The server renders as online, so nothing flashes. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/**
 * Says so when the phone has no signal, instead of letting every tap fail
 * quietly. Attendance marks are the one thing that queues and sends later
 * (lib/offline-attendance-queue.ts); everything else needs a connection.
 */
export function OfflineBanner() {
  if (useOnline()) return null;
  return (
    <output className="mb-4 flex items-start gap-3 rounded-xl bg-warning/15 px-4 py-3 text-sm text-foreground">
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">You&apos;re offline.</span> Attendance marks will send when you&apos;re back online.
        Other changes won&apos;t save until then.
      </p>
    </output>
  );
}
