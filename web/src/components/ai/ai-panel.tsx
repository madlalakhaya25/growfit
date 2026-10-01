"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { RefreshCw } from "lucide-react";
import { AiProse } from "@/components/ai/ai-prose";
import { AiFeedbackControl } from "@/components/ai/ai-feedback";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import type { AiFeedback } from "@/lib/ai-artefacts";
import { formatDayMonth } from "@/lib/time";

export interface AiPanelProps {
  icon: LucideIcon;
  title: string;
  /** Idle state: one sentence saying what generating will do. */
  idleMessage: string;
  /** Spoken and shown while generating, e.g. "Building development plan…". */
  pendingMessage: string;
  generateLabel: string;
  /** The generated text, or null before anything exists. */
  content: string | null;
  /** When the content was generated (ISO). Shown as provenance in place of an empty prompt. */
  generatedAt?: string | null;
  pending: boolean;
  error: string | null;
  onGenerate: () => void;
  /**
   * A viewer who can read but not generate (a player or parent looking at an
   * approved plan). No generate / refresh controls and no feedback.
   */
  readOnly?: boolean;
  /** Omit to hide the thumbs control. */
  feedback?: { value: AiFeedback | null; onChange: (next: AiFeedback | null) => void; disabled?: boolean };
  /** Extra header actions, e.g. an Approve button. */
  actions?: ReactNode;
  /** Rendered under the content, e.g. an Apply button or an approval stamp. */
  footer?: ReactNode;
}

/**
 * The shared shell for an AI output: idle -> pending -> content / error, with
 * provenance ("Generated 3 Oct") and a Refresh in place of a bare "Generate"
 * prompt once something exists.
 *
 * Replaces two panels that were identical apart from the action name and the
 * copy. Deliberately not yet adopted by the report / session / health panels --
 * they have their own forms and Apply buttons, so migrating them here would
 * make this change unreviewable; they follow as a behaviour-preserving pass.
 */
export function AiPanel({
  icon: Icon,
  title,
  idleMessage,
  pendingMessage,
  generateLabel,
  content,
  generatedAt,
  pending,
  error,
  onGenerate,
  readOnly,
  feedback,
  actions,
  footer,
}: AiPanelProps) {
  const hasContent = !!content;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="truncate text-sm font-semibold">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && generatedAt && (
            <span className="text-xs text-muted-foreground">Generated {formatDayMonth(generatedAt)}</span>
          )}
          {actions}
          {!readOnly && hasContent && (
            <Button type="button" size="sm" variant="outline" onClick={onGenerate} disabled={pending}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {pending && (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Spinner label={pendingMessage} />
          {pendingMessage}
        </div>
      )}

      {!pending && error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" onClick={onGenerate}>
              Try again
            </Button>
          )}
        </div>
      )}

      {!pending && !error && !hasContent && (
        <EmptyState
          message={idleMessage}
          action={
            readOnly ? undefined : (
              <Button type="button" size="sm" onClick={onGenerate}>
                <Icon className="size-3.5" aria-hidden="true" />
                {generateLabel}
              </Button>
            )
          }
        />
      )}

      {!pending && hasContent && (
        <>
          <AiProse text={content} className="px-4 py-4" />
          {(footer || (feedback && !readOnly)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2">
              <div>{footer}</div>
              {feedback && !readOnly && <AiFeedbackControl {...feedback} />}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
