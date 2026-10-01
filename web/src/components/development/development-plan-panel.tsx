"use client";

import { useState, useTransition } from "react";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { generateDevelopmentPlan } from "@/app/actions/development-plan";
import { AiPanel } from "@/components/ai/ai-panel";

export function DevelopmentPlanPanel({ playerId }: { playerId: string }) {
  const [plan, setPlan] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateDevelopmentPlan(playerId);
      if (result.error) { setError(result.error); toast.error(result.error); }
      else { setPlan(result.plan ?? null); setGeneratedAt(new Date().toISOString()); }
    });
  }

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
      onGenerate={handleGenerate}
    />
  );
}
