"use client";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { markMatchAttendance, markTrainingAttendance } from "@/app/actions/attendance";
import {
  listQueuedAttendanceWrites,
  removeQueuedAttendanceWrite,
  type QueuedAttendanceWrite,
} from "@/lib/offline-attendance-queue";

async function replay(write: QueuedAttendanceWrite): Promise<boolean> {
  const res =
    write.kind === "match"
      ? await markMatchAttendance(write.fixtureId, write.playerId, write.status)
      : await markTrainingAttendance(write.sessionId, write.playerId, write.status);
  return !res?.error;
}

/**
 * Retries queued attendance writes on mount and whenever the browser comes
 * back online. Stops at the first write that still fails on the network
 * (rather than throwing away the rest) so a still-offline browser doesn't
 * burn through every queued item on one failed attempt.
 */
export function useAttendanceQueueFlush(onFlushed?: () => void) {
  const flush = useCallback(async () => {
    let queued: QueuedAttendanceWrite[];
    try {
      queued = await listQueuedAttendanceWrites();
    } catch {
      return;
    }
    if (!queued.length) return;

    let flushedCount = 0;
    for (const write of queued) {
      try {
        const ok = await replay(write);
        if (ok) {
          await removeQueuedAttendanceWrite(write.id);
          flushedCount += 1;
        } else {
          await removeQueuedAttendanceWrite(write.id);
        }
      } catch {
        break; // still offline — leave the rest queued for next time
      }
    }

    if (flushedCount > 0) {
      toast.success(`Synced ${flushedCount} queued attendance mark${flushedCount === 1 ? "" : "s"}`);
      onFlushed?.();
    }
  }, [onFlushed]);

  useEffect(() => {
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush]);
}
