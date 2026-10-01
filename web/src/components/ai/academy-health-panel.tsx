"use client";

import { Activity } from "lucide-react";
import { generateAcademyHealthReport } from "@/app/actions/academy-health";
import { AiPanel } from "@/components/ai/ai-panel";
import { StoredAiNotices } from "@/components/ai/stored-ai-notices";
import { useStoredAi, type InitialAiResult } from "@/components/ai/use-stored-ai";

export function AcademyHealthPanel({ initial }: { initial?: InitialAiResult | null }) {
  const ai = useStoredAi((force) => generateAcademyHealthReport({ force }), (r) => r.report, initial);

  return (
    <AiPanel
      icon={Activity}
      title="Academy Health Report"
      idleMessage="Get a monthly analysis of your academy — player development, compliance, training load and priorities."
      pendingMessage="Analysing academy data…"
      generateLabel="Generate report"
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
