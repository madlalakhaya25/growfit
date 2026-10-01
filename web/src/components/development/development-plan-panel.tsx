"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Target } from "lucide-react";
import { toast } from "sonner";
import {
  approveDevelopmentPlan,
  generateDevelopmentPlan,
  setDevelopmentPlanFeedback,
} from "@/app/actions/development-plan";
import { AiPanel } from "@/components/ai/ai-panel";
import { Button } from "@/components/ui/button";
import type { AiFeedback } from "@/lib/ai-artefacts";

/** A plan already stored for this player, read on the server so it's there on load. */
export interface InitialDevelopmentPlan {
  artefactId: string;
  plan: string;
  generatedAt: string;
  status: "draft" | "approved";
  approvedByName: string | null;
  feedback: AiFeedback | null;
}

/**
 * The coach's development plan for one player. Remembers: a plan generated on
 * Tuesday is here on Wednesday, regeneration is free when nothing the model
 * saw has changed, and a coach approves a plan before the player or parent can
 * see any of it.
 */
export function DevelopmentPlanPanel({
  playerId,
  initial,
}: {
  playerId: string;
  initial?: InitialDevelopmentPlan | null;
}) {
  const [plan, setPlan] = useState<string | null>(initial?.plan ?? null);
  const [artefactId, setArtefactId] = useState<string | null>(initial?.artefactId ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initial?.generatedAt ?? null);
  const [status, setStatus] = useState<"draft" | "approved">(initial?.status ?? "draft");
  const [approvedByName, setApprovedByName] = useState<string | null>(initial?.approvedByName ?? null);
  const [feedback, setFeedback] = useState<AiFeedback | null>(initial?.feedback ?? null);
  const [unchanged, setUnchanged] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isApproving, startApprove] = useTransition();

  function generate(force: boolean) {
    setError(null);
    setUnchanged(false);
    startTransition(async () => {
      const result = await generateDevelopmentPlan({ playerId, force });
      if (result.error) { setError(result.error); toast.error(result.error); return; }
      setPlan(result.plan ?? null);
      setArtefactId(result.artefactId ?? null);
      setGeneratedAt(result.generatedAt ?? null);
      setStatus(result.status ?? "draft");
      setApprovedByName(result.approvedByName ?? null);
      setFeedback(result.feedback ?? null);
      setUnchanged(result.cached === true);
      setUnsaved(result.persisted === false);
    });
  }

  function approve() {
    if (!artefactId) return;
    startApprove(async () => {
      const result = await approveDevelopmentPlan(artefactId);
      if (result.error) { toast.error(result.error); return; }
      setStatus("approved");
      setApprovedByName(result.approvedByName ?? null);
      toast.success("Plan approved. The player and parent can now see it.");
    });
  }

  function rate(next: AiFeedback | null) {
    const before = feedback;
    setFeedback(next); // optimistic
    if (!artefactId) return;
    void setDevelopmentPlanFeedback(artefactId, next).then((r) => {
      if (r.error) { setFeedback(before); toast.error(r.error); }
    });
  }

  const footer = plan ? (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      {status === "approved" ? (
        <p className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
          Approved{approvedByName ? ` by ${approvedByName}` : ""} — shared with the player and parent.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span>Draft — only coaches can see this.</span>
          {artefactId && (
            <Button type="button" size="sm" onClick={approve} disabled={isApproving}>
              {isApproving ? "Approving…" : "Approve & share"}
            </Button>
          )}
        </div>
      )}
      {unchanged && (
        <p className="flex flex-wrap items-center gap-2">
          Nothing has changed since this plan was made.
          <Button type="button" size="sm" variant="ghost" onClick={() => generate(true)} disabled={isPending}>
            Regenerate anyway
          </Button>
        </p>
      )}
      {unsaved && <p>This plan couldn&apos;t be saved — an administrator needs to apply the latest database update.</p>}
    </div>
  ) : undefined;

  return (
    <AiPanel
      icon={Target}
      title="Personal Development Plan"
      idleMessage="Build a 4-week plan from this player's attributes, ratings and milestone progress."
      pendingMessage="Building development plan…"
      generateLabel="Generate plan"
      content={plan}
      generatedAt={generatedAt}
      pending={isPending}
      error={error}
      onGenerate={() => generate(false)}
      feedback={artefactId ? { value: feedback, onChange: rate } : undefined}
      footer={footer}
    />
  );
}
