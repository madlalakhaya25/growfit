"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDayMonth } from "@/lib/time";
import { saveTrainingRegister } from "@/app/actions/attendance";
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
              aria-pressed={isActive}
              onClick={() => onMark(player.id, status)}
              className={cn(
                "flex min-h-11 items-center gap-1 rounded-[8px] px-2.5 text-[13px] font-semibold transition-colors sm:min-h-9",
                isActive ? cn(active, "shadow-[0_2px_6px_rgb(0_0_0/0.15)]") : "text-foreground/75 hover:text-foreground"
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

/** How long the register waits after the last tap before saving the batch. */
export const REGISTER_SAVE_DELAY_MS = 800;

type Mark = { playerId: string; status: AttendanceStatus };

const SAVE_LABEL = { idle: "", saving: "Saving…", saved: "Saved" } as const;

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Taps wait here and go to the server together (saveTrainingRegister), so
  // marking a squad costs one round trip instead of one per tap. `saved` is
  // what the server last confirmed, to put a row back if a save is refused.
  const pending = useRef(new Map<string, AttendanceStatus>());
  const saved = useRef<Record<string, AttendanceStatus>>({ ...statusMap });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useAttendanceQueueFlush(() => router.refresh());

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current.size === 0) return;
    const batch: Mark[] = [...pending.current].map(([playerId, status]) => ({ playerId, status }));
    pending.current = new Map();
    setSaveState("saving");

    try {
      const res = await saveTrainingRegister(sessionId, batch);
      if (res?.error) {
        // Put back only the rows the coach hasn't changed again since.
        setStatusMap((prev) => {
          const next = { ...prev };
          for (const { playerId, status } of batch) {
            if (next[playerId] !== status) continue;
            const before = saved.current[playerId];
            if (before) next[playerId] = before;
            else delete next[playerId];
          }
          return next;
        });
        setSaveState("idle");
        toast.error(res.error);
        return;
      }
      for (const { playerId, status } of batch) saved.current[playerId] = status;
      setSaveState(pending.current.size > 0 ? "saving" : "saved");
    } catch {
      const queuedAt = new Date().toISOString();
      for (const { playerId, status } of batch) {
        await enqueueAttendanceWrite({
          id: `training:${sessionId}:${playerId}:${Date.now()}`,
          kind: "training",
          sessionId,
          playerId,
          status,
          queuedAt,
        });
      }
      setSaveState("idle");
      toast("Saved offline — will sync when you're back online", { duration: 5000 });
    }
  }, [sessionId]);

  // Save straight away when the coach leaves the page or locks the phone, so a
  // tap made just before is never lost to the delay.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  function queue(marks: Mark[], now = false) {
    setStatusMap((prev) => ({ ...prev, ...Object.fromEntries(marks.map((m) => [m.playerId, m.status])) }));
    for (const m of marks) pending.current.set(m.playerId, m.status);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    if (now) void flush();
    else timer.current = setTimeout(() => void flush(), REGISTER_SAVE_DELAY_MS);
  }

  const handleMark = (playerId: string, status: AttendanceStatus) => queue([{ playerId, status }]);

  // Same rule the welfare threshold uses: late counts as turning up, excused
  // is left out of the total rather than counted against the player.
  const summary = summariseAttendance(Object.values(statusMap));
  const unmarkedPlayers = players.filter((p) => !statusMap[p.id]);
  const unmarked = unmarkedPlayers.length;

  /**
   * One-tap "everyone's here": only the currently-unmarked players, so an
   * exception (Late/Absent/Excused) already tapped is never overwritten.
   */
  const handleMarkAllPresent = () =>
    queue(unmarkedPlayers.map((p) => ({ playerId: p.id, status: "present" as const })), true);

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
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {SAVE_LABEL[saveState]}
          </span>
          {unmarked > 0 && (
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="min-h-11 rounded-md border border-green-500/40 bg-green-500/10 px-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-500/20 sm:min-h-9 dark:text-green-400"
            >
              Mark remaining {unmarked} present
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
