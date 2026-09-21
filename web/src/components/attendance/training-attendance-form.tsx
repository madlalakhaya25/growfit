"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { markTrainingAttendance, markAllPresent } from "@/app/actions/attendance";
import { enqueueAttendanceWrite } from "@/lib/offline-attendance-queue";
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_LABELS,
  isAttendanceStatus,
  summariseAttendance,
  type AttendanceStatus,
} from "@/lib/attendance";
import { useAttendanceQueueFlush } from "./use-attendance-queue-flush";

interface Player {
  id: string;
  full_name: string;
}

interface ExistingRecord {
  player_id: string;
  status: string;
}

interface Props {
  sessionId: string;
  players: Player[];
  existing: ExistingRecord[];
}

/**
 * Per-state styling. Late and excused are deliberately not red: the policy's
 * stated purpose is triggering a welfare conversation, and neither of those
 * is the thing it is looking for.
 */
const STATUS_STYLE: Record<AttendanceStatus, { active: string; idle: string; Icon: typeof CheckCircle2 }> = {
  present: {
    active: "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400",
    idle: "border-border text-muted-foreground hover:border-green-400 hover:text-green-600",
    Icon: CheckCircle2,
  },
  late: {
    active: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    idle: "border-border text-muted-foreground hover:border-amber-400 hover:text-amber-600",
    Icon: Clock,
  },
  excused: {
    active: "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    idle: "border-border text-muted-foreground hover:border-sky-400 hover:text-sky-600",
    Icon: ShieldCheck,
  },
  absent: {
    active: "border-destructive bg-destructive/10 text-destructive",
    idle: "border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive",
    Icon: XCircle,
  },
};

function PlayerRow({
  player,
  currentStatus,
  onMark,
}: {
  player: Player;
  currentStatus: AttendanceStatus | null;
  onMark: (playerId: string, status: AttendanceStatus) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
      <span className="text-sm font-medium">{player.full_name}</span>
      <div
        role="group"
        aria-label={`Attendance for ${player.full_name}`}
        className="flex flex-wrap gap-1.5"
      >
        {ATTENDANCE_STATUSES.map((status) => {
          const { active, idle, Icon } = STATUS_STYLE[status];
          const isActive = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              disabled={pending}
              aria-pressed={isActive}
              onClick={() => startTransition(() => onMark(player.id, status))}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                isActive ? active : idle,
                pending && "cursor-wait opacity-50"
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {ATTENDANCE_LABELS[status]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TrainingAttendanceForm({ sessionId, players, existing }: Props) {
  const router = useRouter();
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(
      existing
        // A row written before migration 036 can still carry the old RSVP
        // vocabulary. Ignore anything unrecognised rather than rendering a
        // row with no button selected and no explanation.
        .filter((r) => isAttendanceStatus(r.status))
        .map((r) => [r.player_id, r.status as AttendanceStatus])
    )
  );
  const [markingAll, setMarkingAll] = useState(false);

  useAttendanceQueueFlush(() => router.refresh());

  async function handleMark(playerId: string, status: AttendanceStatus) {
    const previous = statusMap[playerId] ?? null;
    setStatusMap((prev) => ({ ...prev, [playerId]: status }));
    try {
      const res = await markTrainingAttendance(sessionId, playerId, status);
      if (res?.error) {
        setStatusMap((prev) => {
          const next = { ...prev };
          if (previous) next[playerId] = previous;
          else delete next[playerId];
          return next;
        });
        toast.error(res.error);
      }
    } catch {
      await enqueueAttendanceWrite({
        id: `training:${sessionId}:${playerId}:${Date.now()}`,
        kind: "training",
        sessionId,
        playerId,
        status,
        queuedAt: new Date().toISOString(),
      });
      toast("Saved offline — will sync when you're back online", { duration: 5000 });
    }
  }

  // Same rule the welfare threshold uses: late counts as turning up, excused
  // is left out of the total rather than counted against the player.
  const summary = summariseAttendance(Object.values(statusMap));
  const unmarkedPlayers = players.filter((p) => !statusMap[p.id]);
  const unmarked = unmarkedPlayers.length;

  async function handleMarkAllPresent() {
    const ids = unmarkedPlayers.map((p) => p.id);
    if (ids.length === 0) return;
    setMarkingAll(true);
    setStatusMap((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = "present";
      return next;
    });
    try {
      const res = await markAllPresent(sessionId, ids);
      if (res?.error) {
        setStatusMap((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        });
        toast.error(res.error);
      } else {
        toast.success(`Marked ${ids.length} player${ids.length === 1 ? "" : "s"} present`);
      }
    } catch {
      const queuedAt = new Date().toISOString();
      for (const id of ids) {
        await enqueueAttendanceWrite({
          id: `training:${sessionId}:${id}:${Date.now()}`,
          kind: "training",
          sessionId,
          playerId: id,
          status: "present",
          queuedAt,
        });
      }
      toast("Saved offline — will sync when you're back online", { duration: 5000 });
    } finally {
      setMarkingAll(false);
    }
  }

  if (players.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <h2 className="text-base font-semibold">Attendance</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {summary.attended} of {summary.assessed || players.length} in
            {summary.pct !== null && ` · ${summary.pct}%`}
            {unmarked > 0 && ` · ${unmarked} unmarked`}
          </span>
          {unmarked > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={markingAll}
              className="rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-500/20 disabled:cursor-wait disabled:opacity-50 dark:text-green-400"
            >
              {markingAll
                ? "Marking…"
                : `Mark remaining ${unmarked} present`}
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            currentStatus={statusMap[p.id] ?? null}
            onMark={handleMark}
          />
        ))}
      </div>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        Late counts as attending. Excused is left out of the percentage
        entirely, so an agreed absence never counts against a player.
      </p>
    </section>
  );
}
