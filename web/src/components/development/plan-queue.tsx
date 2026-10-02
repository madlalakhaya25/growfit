"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { approveDevelopmentPlan, generateDevelopmentPlan, saveDevelopmentPlanEdits } from "@/app/actions/development-plan";
import { Button } from "@/components/ui/button";
import { categoryMeta } from "@/lib/development-categories";
import { findFlaggedWording } from "@/lib/child-safe-check";
import { planChanges } from "@/lib/plan-edits";
import type { DevelopmentPlanStructured } from "@/lib/development-plan-schema";
import type { QueuePlayer } from "@/lib/plan-queue-data";

type Entry = NonNullable<QueuePlayer["plan"]>;

const FIELD = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

/** The words a child will read, editable. Saved as one change; the model's structure is untouched. */
function PlanEditor({
  entry,
  sharedAreas,
  onSaved,
  onApproved,
}: Readonly<{
  entry: Entry;
  sharedAreas: string[] | null;
  onSaved: (data: DevelopmentPlanStructured) => void;
  onApproved: () => void;
}>) {
  const [draft, setDraft] = useState(entry.data);
  const [dirty, setDirty] = useState(false);
  const [flagged, setFlagged] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const changes = planChanges(sharedAreas, draft.focusAreas.map((f) => f.area));
  // Live, so the coach sees a flag appear or clear as they edit.
  const liveFlags = findFlaggedWording(
    [draft.playerNote, ...draft.focusAreas.flatMap((f) => [f.area, f.why]), ...draft.actions.flatMap((a) => [a.what, a.how, a.measure])].join(" \n ")
  );

  function change(next: DevelopmentPlanStructured) {
    setDraft(next);
    setDirty(true);
    setFlagged(null);
  }

  async function persist(): Promise<boolean> {
    if (!dirty) return true;
    const res = await saveDevelopmentPlanEdits(entry.artefactId, {
      playerNote: draft.playerNote,
      focusAreas: draft.focusAreas.map((f) => ({ area: f.area, why: f.why })),
      actions: draft.actions.map((a) => ({ what: a.what, how: a.how, measure: a.measure })),
    });
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    setDirty(false);
    onSaved(draft);
    return true;
  }

  function approve(acknowledgeWording: boolean) {
    startBusy(async () => {
      if (!(await persist())) return;
      const res = await approveDevelopmentPlan(entry.artefactId, { acknowledgeWording });
      if (res.flagged) {
        setFlagged(res.error ?? "Some wording may read as negative.");
        return;
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Plan approved. The player and parent can now see it.");
      onApproved();
    });
  }

  return (
    <div className="space-y-3 border-t pt-3">
      {sharedAreas && (
        <p className="text-xs text-muted-foreground">
          {changes.added.length === 0 && changes.dropped.length === 0
            ? "Same focus areas as the plan the family can see now."
            : `Compared with the plan the family sees now: ${[
                changes.added.length ? `new: ${changes.added.join(", ")}` : "",
                changes.dropped.length ? `dropped: ${changes.dropped.join(", ")}` : "",
                changes.kept.length ? `kept: ${changes.kept.join(", ")}` : "",
              ].filter(Boolean).join("; ")}.`}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-medium">Note to the player</span>
        <textarea className={FIELD} rows={3} value={draft.playerNote} onChange={(e) => change({ ...draft, playerNote: e.target.value })} />
      </label>

      {draft.focusAreas.map((f, i) => (
        <fieldset key={`${f.category}-${f.area}`} className="space-y-1">
          <legend className="text-xs font-medium">Focus: {categoryMeta(f.category)?.label ?? f.category}</legend>
          <input className={FIELD} aria-label="Focus area" value={f.area} onChange={(e) => change({ ...draft, focusAreas: draft.focusAreas.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)) })} />
          <textarea className={FIELD} aria-label="Why this focus" rows={2} value={f.why} onChange={(e) => change({ ...draft, focusAreas: draft.focusAreas.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)) })} />
        </fieldset>
      ))}

      {draft.actions.map((a, i) => (
        <fieldset key={`${a.what}-${a.timesPerWeek}`} className="space-y-1">
          <legend className="text-xs font-medium">Action {i + 1} ({a.timesPerWeek}x a week)</legend>
          <input className={FIELD} aria-label="Action" value={a.what} onChange={(e) => change({ ...draft, actions: draft.actions.map((x, j) => (j === i ? { ...x, what: e.target.value } : x)) })} />
          <textarea className={FIELD} aria-label="How to do it" rows={2} value={a.how} onChange={(e) => change({ ...draft, actions: draft.actions.map((x, j) => (j === i ? { ...x, how: e.target.value } : x)) })} />
        </fieldset>
      ))}

      {(flagged || liveFlags.length > 0) && (
        <p className="rounded-md bg-warning/10 p-2 text-xs">
          {flagged ?? `Some wording may read as negative to a child (${liveFlags.map((f) => `"${f}"`).join(", ")}). Edit it, or approve it as it is.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy || !dirty} onClick={() => startBusy(async () => { if (await persist()) toast.success("Changes saved."); })}>
          Save changes
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => approve(false)}>
          {busy ? "Working…" : "Approve & share"}
        </Button>
        {flagged && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => approve(true)}>
            Approve anyway
          </Button>
        )}
      </div>
    </div>
  );
}

/** Every player on the squad with their plan's state, so a whole squad's plans are reviewed in one sitting. */
export function PlanQueue({ players }: Readonly<{ players: QueuePlayer[] }>) {
  const [plans, setPlans] = useState<Record<string, Entry | null>>(() => Object.fromEntries(players.map((p) => [p.id, p.plan])));
  const [open, setOpen] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (players.length === 0) return <p className="text-sm text-muted-foreground">There are no active players on this team yet.</p>;

  const missing = players.filter((p) => !plans[p.id]);

  async function draftOne(playerId: string): Promise<boolean> {
    const res = await generateDevelopmentPlan({ playerId });
    if (res.error || !res.artefactId || !res.structured) {
      toast.error(res.error ?? "Couldn't make that plan.");
      return false;
    }
    const artefactId = res.artefactId;
    const data = res.structured;
    setPlans((all) => ({
      ...all,
      [playerId]: { artefactId, status: res.status ?? "draft", data, createdAt: res.generatedAt ?? "" },
    }));
    return true;
  }

  // One at a time: each is a model call under the academy's hourly AI budget, so stop at the first refusal.
  function draftMissing() {
    startTransition(async () => {
      for (const p of missing) {
        setWorking(p.id);
        if (!(await draftOne(p.id))) break;
      }
      setWorking(null);
    });
  }

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <Button type="button" onClick={draftMissing} disabled={isPending}>
          <Sparkles className="size-4" aria-hidden="true" />
          {isPending ? "Drafting…" : `Draft plans for the ${missing.length} without one`}
        </Button>
      )}
      <ul className="space-y-2">
        {players.map((p) => {
          const entry = plans[p.id];
          const isOpen = open === p.id && entry?.status === "draft";
          return (
            <li key={p.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {working === p.id && "Drafting…"}
                  {working !== p.id && !entry && "No plan yet"}
                  {entry?.status === "approved" && (
                    <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-success" aria-hidden="true" /> Approved</span>
                  )}
                  {entry?.status === "draft" && (
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(isOpen ? null : p.id)}>
                      {isOpen ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
                      Review draft
                    </Button>
                  )}
                </span>
              </div>
              {isOpen && entry && (
                <PlanEditor
                  key={entry.artefactId}
                  entry={entry}
                  sharedAreas={p.sharedAreas}
                  onSaved={(data) => setPlans((all) => ({ ...all, [p.id]: { ...entry, data } }))}
                  onApproved={() => {
                    setPlans((all) => ({ ...all, [p.id]: { ...entry, status: "approved" } }));
                    setOpen(null);
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
