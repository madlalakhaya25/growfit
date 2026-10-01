"use client";

import { Sparkles } from "lucide-react";
import { getPlayerInsights } from "@/app/actions/ai-insights";
import { AiPanel } from "@/components/ai/ai-panel";
import { StoredAiNotices } from "@/components/ai/stored-ai-notices";
import { useStoredAi, type InitialAiResult } from "@/components/ai/use-stored-ai";

export function AiInsightsPanel({
  playerId,
  initial,
}: {
  playerId: string;
  initial?: InitialAiResult | null;
}) {
  const ai = useStoredAi((force) => getPlayerInsights(playerId, { force }), (r) => r.insights, initial);

  return (
    <AiPanel
      icon={Sparkles}
      title="Coaching Insights"
      idleMessage="Get coaching recommendations from this player's ratings, attributes and milestones."
      pendingMessage="Analysing player data…"
      generateLabel="Generate insights"
      content={ai.text}
      generatedAt={ai.generatedAt}
      pending={ai.pending}
      error={ai.error}
      onGenerate={() => ai.generate(false)}
      feedback={ai.artefactId ? { value: ai.feedback, onChange: ai.rate } : undefined}
      footer={
        <StoredAiNotices unchanged={ai.unchanged} unsaved={ai.unsaved} pending={ai.pending} onRegenerate={() => ai.generate(true)} />
      }
    />
  );
}
