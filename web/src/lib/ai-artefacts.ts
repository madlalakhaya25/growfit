// NOT "use server" -- plain helpers that take the Supabase client, matching
// lib/features.ts and lib/coached-teams.ts. A "use server" file may export only
// async functions, and this module also exports pure functions and constants.
//
// The artefact store (migration 045). Every AI output used to live in a
// useState and be thrown away; this is where one is kept, with provenance
// (which model, how many tokens), a coach-approval state and feedback.
//
// ─── The cache-hit rule ──────────────────────────────────────────────────────
// A stored artefact is served instead of a Gemini call only when ALL hold:
//
//   1. kind, subject_type and subject_id match;
//   2. superseded_at IS NULL;
//   3. inputs_fingerprint equals the fingerprint of the brief just built --
//      i.e. nothing the model saw has changed;
//   4. model_id equals the currently configured model for that kind, so a
//      GEMINI_MODEL change forces a regenerate (the failure ai-models.ts's own
//      header describes);
//   5. created_at is inside the kind's window (AI_ARTEFACT_TTL);
//   6. the caller didn't pass force: true.
//
// Invalidation therefore needs NO cache-busting calls anywhere: a new
// completion, rating or register mark changes the brief, so the fingerprint
// changes and (3) fails. A model change fails (4). Time fails (5). An explicit
// Regenerate fails (6) and additionally stamps superseded_at on the previous
// live row, so history stays linear.
//
// LOAD-BEARING CONSEQUENCE: the brief builder must be deterministic. Any
// unstable ordering -- an unsorted .select(), a Map iteration, a timestamp in
// the text -- makes the fingerprint thrash, the cache never hits, and the only
// symptom is a bill nobody traces. Sort every collection inside the builder.
// The opposite error is just as real: a rolling attendance window whose start
// moves daily changes the fingerprint every day with no new data, so the TTL
// is never used. Bucket such a window to a fixed boundary inside the builder.

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiArtefactKind =
  | "development_plan" | "development_plan_shared" | "player_insights"
  | "academy_health"   | "match_plan"             | "session_plan"
  | "parent_report"    | "match_report"
  // Migration 048 widens ai_artefacts_kind_check for this one.
  | "scouting_report";

export type AiSubjectType = "player" | "fixture" | "team" | "academy";
export type AiArtefactStatus = "draft" | "approved";
export type AiFeedback = "helpful" | "not_helpful";

export interface AiArtefactTokens {
  prompt: number | null;
  output: number | null;
  thinking: number | null;
  total: number | null;
}

export interface AiArtefact<T = unknown> {
  id: string;
  kind: AiArtefactKind;
  subjectType: AiSubjectType;
  subjectId: string;
  data: T;
  prose: string | null;
  modelId: string;
  inputsFingerprint: string;
  tokens: AiArtefactTokens;
  status: AiArtefactStatus;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  feedback: AiFeedback | null;
  supersededAt: string | null;
  createdBy: string;
  createdAt: string;
}

const NO_TOKENS: AiArtefactTokens = { prompt: null, output: null, thinking: null, total: null };

/**
 * True when migration 045 hasn't been applied: PostgREST PGRST205, Postgres
 * 42P01. DISTINCT from isMissingAttributeColumn (PGRST204 / 42703), which are
 * the *column* codes and do NOT fire for a missing table. Reusing the column
 * helper here would surface a hard failure on a coach's screen.
 */
export function isMissingAiArtefactsTable(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

/** sha256 hex of the brief. node:crypto; server-only. */
export function fingerprintBrief(brief: string): string {
  return createHash("sha256").update(brief, "utf8").digest("hex");
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Narrow, defensive read of @google/genai's `usageMetadata`
 * (promptTokenCount / candidatesTokenCount / thoughtsTokenCount /
 * totalTokenCount -- confirmed against the installed genai.d.ts). Returns
 * all-null rather than throwing when the shape differs: token counts are
 * telemetry, never worth failing a coach's request over.
 */
export function readUsage(response: unknown): AiArtefactTokens {
  const usage = (response as { usageMetadata?: Record<string, unknown> } | null | undefined)?.usageMetadata;
  if (!usage || typeof usage !== "object") return { ...NO_TOKENS };
  return {
    prompt: num(usage.promptTokenCount),
    output: num(usage.candidatesTokenCount),
    thinking: num(usage.thoughtsTokenCount),
    total: num(usage.totalTokenCount),
  };
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Per-kind freshness window in ms. */
export const AI_ARTEFACT_TTL: Record<AiArtefactKind, number> = {
  development_plan: 28 * DAY, // its own 4-week horizon
  development_plan_shared: 28 * DAY,
  player_insights: 7 * DAY,
  academy_health: 24 * HOUR,
  match_plan: 7 * DAY,
  session_plan: 7 * DAY,
  parent_report: 7 * DAY,
  match_report: 7 * DAY,
  scouting_report: 24 * HOUR, // a week out it is stale; a day out it is not
};

/** Pure: the documented cache rule (conditions 2-5; 1 is the query, 6 the caller). */
export function isCacheHit(
  artefact: Pick<AiArtefact, "modelId" | "inputsFingerprint" | "supersededAt" | "createdAt" | "kind">,
  want: { modelId: string; inputsFingerprint: string },
  now: Date = new Date()
): boolean {
  if (artefact.supersededAt) return false;
  if (artefact.inputsFingerprint !== want.inputsFingerprint) return false;
  if (artefact.modelId !== want.modelId) return false;
  const created = new Date(artefact.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return now.getTime() - created <= AI_ARTEFACT_TTL[artefact.kind];
}

type Row = Record<string, unknown>;

/** Snake-case DB row -> AiArtefact. Exported for tests. */
export function mapArtefactRow<T>(row: Row): AiArtefact<T> {
  return {
    id: row.id as string,
    kind: row.kind as AiArtefactKind,
    subjectType: row.subject_type as AiSubjectType,
    subjectId: row.subject_id as string,
    data: row.data as T,
    prose: (row.prose as string | null) ?? null,
    modelId: row.model_id as string,
    inputsFingerprint: row.inputs_fingerprint as string,
    tokens: {
      prompt: num(row.prompt_tokens),
      output: num(row.output_tokens),
      thinking: num(row.thinking_tokens),
      total: num(row.total_tokens),
    },
    status: row.status as AiArtefactStatus,
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedByName: (row.approved_by_name as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    feedback: (row.feedback as AiFeedback | null) ?? null,
    supersededAt: (row.superseded_at as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

// `available: false` is the lagging-migration signal, mirroring
// getAcademyFeatures' "every feature reads as on": the caller falls through to
// a live Gemini call, so the UI loses persistence, not function.

export async function getLatestAiArtefact<T>(
  // The Supabase client is generated without database types in this project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    kind: AiArtefactKind;
    subjectType: AiSubjectType;
    subjectId: string;
    status?: AiArtefactStatus;
    includeSuperseded?: boolean;
  }
): Promise<{ artefact: AiArtefact<T> | null; available: boolean; error?: string }> {
  try {
    let q = supabase
      .from("ai_artefacts")
      .select("*")
      .eq("kind", input.kind)
      .eq("subject_type", input.subjectType)
      .eq("subject_id", input.subjectId);
    if (input.status) q = q.eq("status", input.status);
    if (!input.includeSuperseded) q = q.is("superseded_at", null);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(1);
    if (error) {
      if (isMissingAiArtefactsTable(error)) return { artefact: null, available: false };
      return { artefact: null, available: true, error: error.message };
    }
    const row = (data as Row[] | null)?.[0];
    return { artefact: row ? mapArtefactRow<T>(row) : null, available: true };
  } catch (e) {
    return { artefact: null, available: true, error: e instanceof Error ? e.message : "Could not read saved AI output." };
  }
}

export async function saveAiArtefact<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    kind: AiArtefactKind;
    subjectType: AiSubjectType;
    subjectId: string;
    academyId: string;
    createdBy: string;
    data: T;
    prose?: string | null;
    modelId: string;
    inputsFingerprint: string;
    tokens?: AiArtefactTokens;
    status?: AiArtefactStatus;
    /** Stamp superseded_at on the previous live artefact of the same
     *  kind+subject. Default true. */
    supersedePrevious?: boolean;
  }
): Promise<{ artefact: AiArtefact<T> | null; persisted: boolean; error?: string }> {
  try {
    if (input.supersedePrevious !== false) {
      const { error: supersedeError } = await supabase
        .from("ai_artefacts")
        .update({ superseded_at: new Date().toISOString() })
        .eq("kind", input.kind)
        .eq("subject_type", input.subjectType)
        .eq("subject_id", input.subjectId)
        .is("superseded_at", null);
      if (supersedeError) {
        if (isMissingAiArtefactsTable(supersedeError)) return { artefact: null, persisted: false };
        return { artefact: null, persisted: false, error: supersedeError.message };
      }
    }

    const tokens = input.tokens ?? NO_TOKENS;
    const { data, error } = await supabase
      .from("ai_artefacts")
      .insert({
        academy_id: input.academyId,
        kind: input.kind,
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        data: input.data,
        prose: input.prose ?? null,
        model_id: input.modelId,
        inputs_fingerprint: input.inputsFingerprint,
        prompt_tokens: tokens.prompt,
        output_tokens: tokens.output,
        thinking_tokens: tokens.thinking,
        total_tokens: tokens.total,
        status: input.status ?? "draft",
        created_by: input.createdBy,
      })
      .select("*")
      .single();
    if (error || !data) {
      if (isMissingAiArtefactsTable(error)) return { artefact: null, persisted: false };
      return { artefact: null, persisted: false, error: error?.message ?? "Could not save AI output." };
    }
    return { artefact: mapArtefactRow<T>(data as Row), persisted: true };
  } catch (e) {
    return { artefact: null, persisted: false, error: e instanceof Error ? e.message : "Could not save AI output." };
  }
}

export async function listAiArtefacts<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { subjectType: AiSubjectType; subjectId: string; kind?: AiArtefactKind; limit?: number }
): Promise<{ artefacts: AiArtefact<T>[]; available: boolean; error?: string }> {
  try {
    let q = supabase
      .from("ai_artefacts")
      .select("*")
      .eq("subject_type", input.subjectType)
      .eq("subject_id", input.subjectId);
    if (input.kind) q = q.eq("kind", input.kind);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(input.limit ?? 20);
    if (error) {
      if (isMissingAiArtefactsTable(error)) return { artefacts: [], available: false };
      return { artefacts: [], available: true, error: error.message };
    }
    return { artefacts: ((data ?? []) as Row[]).map((r) => mapArtefactRow<T>(r)), available: true };
  } catch (e) {
    return { artefacts: [], available: true, error: e instanceof Error ? e.message : "Could not read saved AI output." };
  }
}

export interface AiUsageSummary {
  calls: number;
  totalTokens: number | null;
  helpful: number;
  notHelpful: number;
  byKind: { kind: AiArtefactKind; calls: number; totalTokens: number | null }[];
}

/**
 * Calls, tokens and feedback for one academy since `since` (ISO). `summary`
 * is null -- not a zero -- when the read failed, so the usage card can show
 * "unavailable" instead of a believable 0 (StatTile's convention).
 */
export async function summariseAiUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { academyId: string; since: string }
): Promise<{ summary: AiUsageSummary | null; available: boolean }> {
  try {
    const { data, error } = await supabase
      .from("ai_artefacts")
      .select("kind, total_tokens, feedback")
      .eq("academy_id", input.academyId)
      .gte("created_at", input.since)
      .limit(10000);
    if (error) return { summary: null, available: !isMissingAiArtefactsTable(error) };

    const byKind = new Map<AiArtefactKind, { calls: number; totalTokens: number | null }>();
    let totalTokens: number | null = null;
    let helpful = 0;
    let notHelpful = 0;
    for (const r of (data ?? []) as { kind: AiArtefactKind; total_tokens: number | null; feedback: AiFeedback | null }[]) {
      const t = num(r.total_tokens);
      if (t !== null) totalTokens = (totalTokens ?? 0) + t;
      if (r.feedback === "helpful") helpful++;
      if (r.feedback === "not_helpful") notHelpful++;
      const k = byKind.get(r.kind) ?? { calls: 0, totalTokens: null };
      k.calls++;
      if (t !== null) k.totalTokens = (k.totalTokens ?? 0) + t;
      byKind.set(r.kind, k);
    }
    return {
      available: true,
      summary: {
        calls: (data ?? []).length,
        totalTokens,
        helpful,
        notHelpful,
        byKind: [...byKind.entries()]
          .map(([kind, v]) => ({ kind, ...v }))
          .sort((a, b) => b.calls - a.calls || a.kind.localeCompare(b.kind)),
      },
    };
  } catch {
    return { summary: null, available: true };
  }
}

/**
 * Hard-delete every artefact about one subject. subject_id is polymorphic with
 * no foreign key, so deleting a player does NOT cascade here -- erasure calls
 * this explicitly (POPIA erasure is not optional). A missing table counts as
 * success: there is nothing to erase, and erasure must not be blocked by an
 * un-applied migration.
 */
export async function deleteAiArtefactsForSubject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { subjectType: AiSubjectType; subjectId: string }
): Promise<{ deleted: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("ai_artefacts")
      .delete()
      .eq("subject_type", input.subjectType)
      .eq("subject_id", input.subjectId);
    if (error) {
      if (isMissingAiArtefactsTable(error)) return { deleted: true };
      return { deleted: false, error: error.message };
    }
    return { deleted: true };
  } catch (e) {
    return { deleted: false, error: e instanceof Error ? e.message : "Could not delete AI output." };
  }
}
