import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fingerprintBrief,
  getLatestAiArtefact,
  isCacheHit,
  readUsage,
  saveAiArtefact,
  type AiArtefactKind,
  type AiFeedback,
  type AiSubjectType,
} from "@/lib/ai-artefacts";
import { reportError } from "@/lib/report-error";

/** What a caller gets back, whether it came from the store or the model. */
export interface CachedTextResult {
  text?: string;
  artefactId?: string;
  /** True when the stored answer was returned and no model call was made. */
  cached?: boolean;
  /** False when generated but not saved (migration 045 pending). */
  persisted?: boolean;
  generatedAt?: string;
  feedback?: AiFeedback | null;
  error?: string;
}

/**
 * The sequence every prose AI feature repeats: serve the stored answer if
 * nothing the model saw has changed, otherwise (budget permitting) generate,
 * clean, and store it.
 *
 * Order is the contract:
 *   1. the cache check -- free, so a hit never spends any of the user's budget;
 *   2. `beforeGenerate` -- the budget check, only when a model call is coming;
 *   3. the model call;
 *   4. save, superseding the previous answer for this subject.
 *
 * `brief` is both what the model is shown and what is fingerprinted, so it must
 * be deterministic -- see the "load-bearing consequence" note in
 * lib/ai-artefacts.ts. A missing table (migration 045 pending) is not an
 * error: the answer is returned with `persisted: false`.
 *
 * Callers are responsible for the authorisation gate BEFORE calling this.
 */
export async function generateOrServeText(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  opts: {
    kind: AiArtefactKind;
    subjectType: AiSubjectType;
    subjectId: string;
    academyId: string;
    userId: string;
    brief: string;
    /** The model id this kind is currently configured with. */
    modelId: string;
    force?: boolean;
    /** Return a message to refuse the call (e.g. over budget), or null to proceed. */
    beforeGenerate?: () => Promise<string | null>;
    /** `response` is the raw SDK response, read only for its token usage. */
    generate: () => Promise<{ text: string; response?: unknown }>;
    now?: Date;
  }
): Promise<CachedTextResult> {
  const now = opts.now ?? new Date();
  const fingerprint = fingerprintBrief(opts.brief);

  const { artefact } = await getLatestAiArtefact<{ text?: string }>(supabase, {
    kind: opts.kind,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
  });

  // An empty stored answer is never a hit: one saved before this check existed
  // (or by a model that returned nothing) would otherwise be served for the
  // whole TTL, so every retry would "succeed" with a blank.
  const stored = artefact?.prose ?? artefact?.data?.text ?? "";
  if (
    !opts.force &&
    artefact &&
    stored.trim() &&
    isCacheHit(artefact, { modelId: opts.modelId, inputsFingerprint: fingerprint }, now)
  ) {
    return {
      text: stored,
      artefactId: artefact.id,
      cached: true,
      persisted: true,
      generatedAt: artefact.createdAt,
      feedback: artefact.feedback,
    };
  }

  const refusal = await opts.beforeGenerate?.();
  if (refusal) return { error: refusal };

  const { text, response } = await opts.generate();
  // A blank answer (a safety block, a truncated reply) is an error to retry,
  // not something to store: saved, it would be served as a hit until it expired.
  if (!text.trim()) return { error: "The AI didn't return an answer. Try again." };

  const saved = await saveAiArtefact<{ text: string }>(supabase, {
    kind: opts.kind,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    academyId: opts.academyId,
    createdBy: opts.userId,
    data: { text },
    prose: text,
    modelId: opts.modelId,
    inputsFingerprint: fingerprint,
    tokens: readUsage(response),
  });
  if (saved.error) {
    reportError(saved.error, { scope: "generateOrServeText", severity: "warning", extra: { kind: opts.kind } });
  }

  return {
    text,
    artefactId: saved.artefact?.id,
    cached: false,
    persisted: saved.persisted,
    generatedAt: saved.artefact?.createdAt ?? now.toISOString(),
    feedback: null,
  };
}
