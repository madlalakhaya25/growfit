"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getPlayerInsights } from "@/app/actions/ai-insights";
import { AiPanel } from "@/components/ai/ai-panel";

export function AiInsightsPanel({ playerId }: { playerId: string }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await getPlayerInsights(playerId);
      if (result.error) { setError(result.error); toast.error(result.error); }
      else { setInsights(result.insights ?? null); setGeneratedAt(new Date().toISOString()); }
    });
  }

  return (
    <AiPanel
      icon={Sparkles}
      title="Coaching Insights"
      idleMessage="Get coaching recommendations from this player's ratings, attributes and milestones."
      pendingMessage="Analysing player data…"
      generateLabel="Generate insights"
      content={insights}
      generatedAt={generatedAt}
      pending={isPending}
      error={error}
      onGenerate={handleGenerate}
    />
  );
}
