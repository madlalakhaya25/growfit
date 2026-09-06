"use client";

/**
 * IndexedDB write queue for attendance marks made with no connection.
 *
 * Scoped to attendance specifically (not a generic offline-write layer) —
 * this is the app's single most-used write path pitchside, and the one the
 * roadmap flagged as failing silently offline. Background Sync isn't used:
 * it has no iOS Safari support, and parents/coaches on this app are not
 * guaranteed Android. Instead this queue is flushed on mount and on the
 * browser's `online` event — good enough for "reconnects a few minutes
 * later," which is the real-world case at a pitch with patchy signal.
 */

const DB_NAME = "growfit-offline-queue";
const STORE_NAME = "attendance-writes";
const DB_VERSION = 1;

export type QueuedAttendanceWrite =
  | {
      id: string;
      kind: "match";
      fixtureId: string;
      playerId: string;
      status: "present" | "absent" | "late" | "excused";
      queuedAt: string;
    }
  | {
      id: string;
      kind: "training";
      sessionId: string;
      playerId: string;
      status: "present" | "absent";
      queuedAt: string;
    };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueAttendanceWrite(write: QueuedAttendanceWrite): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(write);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listQueuedAttendanceWrites(): Promise<QueuedAttendanceWrite[]> {
  const db = await openDb();
  try {
    return await new Promise<QueuedAttendanceWrite[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result as QueuedAttendanceWrite[]);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function removeQueuedAttendanceWrite(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
