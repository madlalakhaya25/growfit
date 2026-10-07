"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/time";
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
  /** What each player said before the session (their RSVP). Shown beside the name, never counted. */
  rsvps?: Record<string, "going" | "cant">;
  /**
   * Who most recently marked this register, and when — surfaced so a
   * co-coach opening a session they didn't create can tell whether the
   * register in front of them is theirs or a colleague's (docs/BACKLOG.md
   * 2.9), rather than the two silently disagreeing about who did what.
   */
  lastMarkedBy?: { name: string; at: string } | null;
}

/**
 * Per-state styling. Late and excused are deliberately not red: the policy's
 * stated purpose is triggering a welfare conversation, and neither of those
 * is the thing it is looking for.
 */
const STATUS_STYLE: Record<AttendanceStatus, { active: string; Icon: typeof CheckCircle2 }> = {
  present: { active: "bg-[#1f7a36] text-white", Icon: CheckCircle2 },
  late: { active: "bg-[#b25000] text-white", Icon: Clock },
  excused: { active: "bg-[#0a63d6] text-white", Icon: ShieldCheck },
  absent: { active: "bg-[#c4161c] text-white", Icon: XCircle },
};

function PlayerRow({
  player,
  currentStatus,
  rsvp,
  onMark,
}: {
  player: Player;
  currentStatus: AttendanceStatus | null;
  rsvp?: "going" | "cant";
  onMark: (playerId: string, status: AttendanceStatus) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
      <span className="text-[17px]">
        {player.full_name}
        {rsvp && (
          <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-xs font-normal", rsvp === "going" ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>
            {rsvp === "going" ? "Said going" : "Said can't"}
          </span>
        )}
      </span>
      {/* An iOS segmented control: one grey track, the chosen status
          filled with its colour. */}
      <div
        role="group"
        aria-label={`Attendance for ${player.full_name}`}
        className="flex rounded-[10px] bg-secondary p-0.5"
      >
        {ATTENDANCE_STATUSES.map((status) => {
          const { active, Icon } = STATUS_STYLE[status];
          const isActive = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              disabled={pending}
              aria-pressed={isActive}
              onClick={() => startTransition(() => onMark(player.id, status))}
              className={cn(
                "flex min-h-11 items-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors sm:min-h-9",
                isActive ? cn(active, "shadow-[0_2px_6px_rgb(0_0_0/0.15)]") : "text-foreground/75 hover:text-foreground",
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

export function TrainingAttendanceForm({ sessionId, players, existing, rsvps, lastMarkedBy }: Readonly<Props>) {
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
    <section className="overflow-hidden rounded-xl bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-base font-semibold">Attendance</h2>
          {lastMarkedBy && (
            <p className="text-xs text-muted-foreground">
              Last marked by {lastMarkedBy.name},{" "}
              {formatDayMonth(lastMarkedBy.at)}
            </p>
          )}
        </div>
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
            rsvp={rsvps?.[p.id]}
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
