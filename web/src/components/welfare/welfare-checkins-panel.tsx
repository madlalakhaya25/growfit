"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartPulse, ChevronRight } from "lucide-react";
import { logWelfareCheckin } from "@/app/actions/welfare";
import type { WelfareAlert } from "@/app/actions/welfare";

interface Props {
  alerts: WelfareAlert[];
}

export function WelfareCheckinsPanel({ alerts }: Props) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  if (alerts.length === 0) return null;

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center gap-2 border-b border-amber-500/20 px-4 py-3">
        <HeartPulse className="size-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold">
          Welfare check-in{alerts.length === 1 ? "" : "s"} needed ({alerts.length})
        </h2>
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Below the 75% training attendance threshold — the academy's policy is
        that this triggers a check-in, not a punishment.
      </p>
      <ul className="divide-y divide-amber-500/10">
        {alerts.map((a) => (
          <li key={a.playerId} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.fullName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.teamName} · {a.attendancePct}% attendance
                  {a.lastCheckin && (
                    <>
                      {" · last checked in "}
                      {new Date(a.lastCheckin.createdAt).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(openId === a.playerId ? null : a.playerId)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-500/30 bg-background px-2.5 py-1 text-xs font-medium hover:bg-amber-500/10"
              >
                Log check-in
                <ChevronRight className={`size-3 transition-transform ${openId === a.playerId ? "rotate-90" : ""}`} aria-hidden="true" />
              </button>
            </div>
            {openId === a.playerId && (
              <CheckinForm
                playerId={a.playerId}
                attendancePct={a.attendancePct}
                onDone={() => {
                  setOpenId(null);
                  router.refresh();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckinForm({
  playerId,
  attendancePct,
  onDone,
}: {
  playerId: string;
  attendancePct: number;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await logWelfareCheckin(playerId, attendancePct, note);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Check-in logged");
      onDone();
    });
  }

  return (
    <div className="mt-2.5 space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What did you follow up on? (optional)"
        rows={2}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save check-in"}
      </button>
    </div>
  );
}
