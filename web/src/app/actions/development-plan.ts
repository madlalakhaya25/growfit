"use server";

import { revalidatePath } from "next/cache";
import { GoogleGenAI, Type } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { requireStaff } from "@/lib/auth";
import { coachesPlayer } from "@/lib/coached-teams";
import {
  ALL_ATTR_SELECT,
  ATTR_META,
  CORE_ATTR_SELECT,
  buildAttributeSnapshot,
  isMissingAttributeColumn,
  type AttrKey,
} from "@/lib/attributes";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { parseJsonObject } from "@/lib/ai-json";
import {
  fingerprintBrief,
  getLatestAiArtefact,
  isCacheHit,
  readUsage,
  saveAiArtefact,
  type AiArtefact,
  type AiFeedback,
} from "@/lib/ai-artefacts";
import { APPROVAL_RULE, PLAYER_FACING_RULE, specialistSystem } from "@/lib/ai-safeguards";
import { summariseAttendance, isAttendanceStatus, type AttendanceStatus } from "@/lib/attendance";
import { loadDevelopmentSnapshot } from "@/lib/development-data";
import { MILESTONE_CATEGORIES } from "@/lib/development-categories";
import {
  ageFromDob,
  bucketedAttendanceStart,
  buildDevelopmentBrief,
  type PreviousPlanContext,
} from "@/lib/development-brief";
import {
  normaliseDevelopmentPlan,
  PLAN_VERDICTS,
  type DevelopmentPlanStructured,
} from "@/lib/development-plan-schema";
import { renderDevelopmentPlanProse, renderPlayerPlanProse, toPlayerSafePlan } from "@/lib/development-plan-view";
import { reportError } from "@/lib/report-error";
import { formatInTimezone } from "@/lib/time";
import { checkPlayerFacing, describeFlags } from "@/lib/child-safe-check";
import { applyPlanEdits, type PlanEdits } from "@/lib/plan-edits";

// The plan types live in a plain lib module so Jest can load them (this file
// imports @google/genai, whose ESM build Jest can't). Re-exported as types so
// the names are available from here too.
export type {
  DevelopmentFocusArea,
  DevelopmentAction,
  PreviousPlanVerdict,
  DevelopmentPlanStructured,
} from "@/lib/development-plan-schema";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

/** The plan's own horizon: reviewDate = four weeks out. */
const PLAN_HORIZON_DAYS = 28;

const NOT_STAFF = "This is available to coaches and admins only.";
const NOT_YOURS = "You don't coach this player.";

const SYSTEM =
  `${specialistSystem({ focus: "individual player development plans" })} ` +
  "Use only facts that are in the brief; never invent a rating, a statistic, a milestone or an event. " +
  `${APPROVAL_RULE} ${PLAYER_FACING_RULE}`;

type PlanResult = {
  plan?: string;
  structured?: DevelopmentPlanStructured;
  artefactId?: string;
  /** True when a stored plan was returned and no model call was made. */
  cached?: boolean;
  /** False when the plan was generated but couldn't be saved (migration 045 pending). */
  persisted?: boolean;
  generatedAt?: string;
  status?: "draft" | "approved";
  approvedByName?: string | null;
  feedback?: AiFeedback | null;
  error?: string;
};

/**
 * Generate (or return the stored) development plan for a player.
 *
 * Order matters: gate, then the free cache check, THEN the budget. A cache hit
 * makes no model call so it must not cost the coach any of their hourly budget,
 * and a probe by a player or parent is refused before it can burn any.
 *
 * Signature changed from `(playerId: string)` to an object. Per web/CLAUDE.md,
 * every branch returns a fresh object literal -- do not hoist one into a shared
 * constant, or callers' `result.error` stops type-checking.
 */
export async function generateDevelopmentPlan(input: {
  playerId: string;
  force?: boolean;
}): Promise<PlanResult> {
  try {
    const { playerId, force } = input;
    const { supabase, user, profile: staff } = await requireStaff();
    if (!staff) return { error: NOT_STAFF };
    if (!(await coachesPlayer(supabase, { userId: user.id, role: staff.role, playerId }))) {
      return { error: NOT_YOURS };
    }
    if (!staff.academy_id) return { error: "Academy not found." };

    const now = new Date();

    const [{ data: player }, attrsResult, ratingsResult, attendanceResult, live] = await Promise.all([
      supabase.from("players").select("full_name, position, date_of_birth").eq("id", playerId).single(),
      // Every assessing coach's row (see buildAttributeSnapshot), not one.
      supabase.from("player_attributes").select(ALL_ATTR_SELECT).eq("player_id", playerId),
      supabase
        .from("player_ratings")
        .select("rating, created_at, fixtures(opponent)")
        .eq("player_id", playerId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("training_attendance")
        .select("status, training_sessions!inner(session_date)")
        .eq("player_id", playerId)
        .gte("training_sessions.session_date", bucketedAttendanceStart(now)),
      getLatestAiArtefact<DevelopmentPlanStructured>(supabase, {
        kind: "development_plan",
        subjectType: "player",
        subjectId: playerId,
      }),
    ]);

    if (!player) return { error: "Player not found." };

    // A project that never ran migration 013 has none of the expanded columns,
    // and the wide SELECT then fails outright -- fall back to the core six.
    let attrRows: Partial<Record<AttrKey, number | null>>[] | null = attrsResult.data;
    if (!attrRows?.length && isMissingAttributeColumn(attrsResult.error)) {
      const { data } = await supabase.from("player_attributes").select(CORE_ATTR_SELECT).eq("player_id", playerId);
      attrRows = data;
    }

    const snapshot = await loadDevelopmentSnapshot(supabase, {
      playerId,
      academyId: staff.academy_id,
      position: player.position ?? null,
      now,
    });
    // Never plan from a pathway that failed to load: a plan that ignores the
    // academy's own milestones would look fine and quietly be wrong.
    if (snapshot.loadError) return { error: snapshot.loadError };

    const attrSnapshot = buildAttributeSnapshot(attrRows, player.position);
    const attributes = attrSnapshot.assessedKeys.map((key) => ({
      label: ATTR_META[key].label,
      value: attrSnapshot.assessed[key]!,
    }));

    type RatingRow = { rating: number; created_at: string; fixtures: { opponent: string } | { opponent: string }[] | null };
    const ratings = ((ratingsResult.data ?? []) as RatingRow[]).map((r) => {
      const fixture = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
      return { rating: r.rating, opponent: fixture?.opponent ?? null, createdAt: r.created_at };
    });

    let attendance: { attended: number; assessed: number; pct: number | null } | null = null;
    if (attendanceResult.error) {
      reportError(attendanceResult.error, { scope: "generateDevelopmentPlan", severity: "warning", extra: { query: "training_attendance" } });
    } else {
      const statuses = ((attendanceResult.data ?? []) as { status: string }[])
        .map((r) => r.status)
        .filter(isAttendanceStatus) as AttendanceStatus[];
      const summary = summariseAttendance(statuses);
      attendance = { attended: summary.attended, assessed: summary.assessed, pct: summary.pct };
    }

    const templateById = new Map(snapshot.templates.map((t) => [t.id, t]));
    const completedThisSeason = snapshot.templates.filter((t) => snapshot.completedThisSeason.has(t.id));
    const open = snapshot.templates.filter((t) => !snapshot.completedThisSeason.has(t.id));

    const previousArtefact: AiArtefact<DevelopmentPlanStructured> | null = live.artefact;
    let previous: PreviousPlanContext | null = null;
    if (previousArtefact) {
      const since = Date.parse(previousArtefact.createdAt);
      const after = (iso: string | null) => (iso ? Date.parse(iso) > since : false);
      previous = {
        createdAt: previousArtefact.createdAt,
        structured: previousArtefact.data,
        newCompletions: (snapshot.seasons.find((s) => s.season === snapshot.currentSeason)?.completions ?? [])
          .filter((c) => after(c.completedAt))
          .flatMap((c) => {
            const t = templateById.get(c.templateId);
            return t ? [{ title: t.title, category: t.category }] : [];
          }),
        newRatings: ratings.filter((r) => after(r.createdAt)).map((r) => ({ rating: r.rating, opponent: r.opponent })),
      };
    }

    const { worldBrief, fullBrief } = buildDevelopmentBrief(
      {
        player: { fullName: player.full_name, position: player.position ?? null, age: ageFromDob(player.date_of_birth, now) },
        attributes,
        ratings,
        completed: completedThisSeason.map((t) => ({ title: t.title, category: t.category })),
        open: open.map((t) => ({ id: t.id, title: t.title, category: t.category, sortOrder: t.sort_order })),
        attendance,
        attendanceSince: bucketedAttendanceStart(now),
      },
      previous
    );
    // Keyed on the WORLD brief only: the previous plan is part of what the model
    // is shown but not of the cache key. See development-brief.ts for why.
    const fingerprint = fingerprintBrief(worldBrief);

    if (!force && previousArtefact && isCacheHit(previousArtefact, { modelId: AI_MODEL, inputsFingerprint: fingerprint }, now)) {
      return {
        plan: previousArtefact.prose ?? renderDevelopmentPlanProse(previousArtefact.data),
        structured: previousArtefact.data,
        artefactId: previousArtefact.id,
        cached: true,
        persisted: true,
        generatedAt: previousArtefact.createdAt,
        status: previousArtefact.status,
        approvedByName: previousArtefact.approvedByName,
        feedback: previousArtefact.feedback,
      };
    }

    // One AI call against this user's hourly budget. Counts attempts, not
    // successes: a failed call still costs a request to the provider.
    const overBudget = await checkAiBudget(user.id);
    if (overBudget) return { error: overBudget };

    const prompt = `Write a focused ${PLAN_HORIZON_DAYS / 7}-week development plan for this player.

${fullBrief}

How to write it:
- Fields marked FOR THE COACH may be candid. Everything else is shown to the player and their parent once the coach approves it, so write focusAreas, actions and playerNote only as things to work toward — never as faults.
- playerSummary (FOR THE COACH): two sentences on current level and position fit.
- focusAreas: 2 or 3. category must be one of ${MILESTONE_CATEGORIES.join(", ")}. area is short; why says what it will unlock for the player, kindly.
- actions: 3 or 4 specific things to do, each with what, how (a concrete drill or habit a child can do), timesPerWeek (1-7), and measure (something observable). Set milestoneTemplateId to one of the ids in brackets under "Open milestones" when the action works toward it, otherwise null.
${previous ? "- previous (FOR THE COACH): judge the PREVIOUS PLAN using only the facts listed under \"WHAT HAS HAPPENED SINCE THAT PLAN\": verdict is worked, partly or not_yet; evidence cites those facts; carriedForward lists what still applies.\n" : ""}- coachNote (FOR THE COACH): one concern or watch-point worth knowing, or an empty string if there is none.
- playerNote: one or two warm, forward-looking sentences addressed to the player ("you").`;

    const planSchema = {
      type: Type.OBJECT,
      properties: {
        playerSummary: { type: Type.STRING },
        focusAreas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING, format: "enum", enum: [...MILESTONE_CATEGORIES] },
              area: { type: Type.STRING },
              why: { type: Type.STRING },
            },
            required: ["category", "area", "why"],
          },
        },
        actions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              what: { type: Type.STRING },
              how: { type: Type.STRING },
              timesPerWeek: { type: Type.NUMBER },
              measure: { type: Type.STRING },
              milestoneTemplateId: { type: Type.STRING, nullable: true },
            },
            required: ["what", "how", "timesPerWeek", "measure"],
          },
        },
        // Only asked for when there is something to judge.
        ...(previous
          ? {
              previous: {
                type: Type.OBJECT,
                properties: {
                  verdict: { type: Type.STRING, format: "enum", enum: PLAN_VERDICTS.filter((v) => v !== "no_previous_plan") },
                  evidence: { type: Type.STRING },
                  carriedForward: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["verdict", "evidence", "carriedForward"],
              },
            }
          : {}),
        coachNote: { type: Type.STRING },
        playerNote: { type: Type.STRING },
      },
      required: ["playerSummary", "focusAreas", "actions", ...(previous ? ["previous"] : []), "coachNote", "playerNote"],
    };

    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: prompt,
      config: {
        // 600 truncated the structured JSON mid-object, which parseJsonObject
        // then reads as null -- "Could not read the plan" on EVERY attempt with
        // no clue why. Sized for 2-3 focus areas + 3-4 actions + two notes +
        // the verdict (in line with generateMatchPlan's 1500). Not yet proven
        // against a live key -- see docs/AI_AND_UX_PLAN_2026.md Part 9.
        maxOutputTokens: 1400,
        // Direct-answer task: unbudgeted thinking tokens would eat the output
        // budget and truncate the answer (web/CLAUDE.md).
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema: planSchema,
      },
    });

    const reviewDate = formatInTimezone(
      new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 3600 * 1000),
      { year: "numeric", month: "2-digit", day: "2-digit" },
      "en-CA"
    );
    const structured = normaliseDevelopmentPlan(parseJsonObject(response.text ?? ""), {
      openMilestoneIds: new Set(open.map((t) => t.id)),
      hasPrevious: previous !== null,
      reviewDate,
    });
    if (!structured) return { error: "Could not read the AI's plan. Try again." };

    const prose = renderDevelopmentPlanProse(structured).replace(/\*/g, "");
    const saved = await saveAiArtefact<DevelopmentPlanStructured>(supabase, {
      kind: "development_plan",
      subjectType: "player",
      subjectId: playerId,
      academyId: staff.academy_id,
      createdBy: user.id,
      data: structured,
      prose,
      modelId: AI_MODEL,
      inputsFingerprint: fingerprint,
      tokens: readUsage(response),
      status: "draft",
    });
    if (saved.error) {
      reportError(saved.error, { scope: "generateDevelopmentPlan", severity: "warning", extra: { step: "saveAiArtefact" } });
    }

    return {
      plan: prose,
      structured,
      artefactId: saved.artefact?.id,
      cached: false,
      persisted: saved.persisted,
      generatedAt: saved.artefact?.createdAt ?? now.toISOString(),
      status: "draft",
      approvedByName: null,
      feedback: null,
    };
  } catch (err) {
    return {
      error: aiError(err),
    };
  }
}

/** Load a plan artefact and check the caller may act on its player. */
async function loadOwnedPlan(artefactId: string) {
  const { supabase, user, profile: staff } = await requireStaff();
  if (!staff) return { error: NOT_STAFF } as const;

  const { data } = await supabase.from("ai_artefacts").select("*").eq("id", artefactId).eq("kind", "development_plan").maybeSingle();
  if (!data) return { error: "That plan no longer exists." } as const;
  if (data.superseded_at) return { error: "A newer plan has replaced this one." } as const;
  if (!(await coachesPlayer(supabase, { userId: user.id, role: staff.role, playerId: data.subject_id }))) {
    return { error: NOT_YOURS } as const;
  }
  return { supabase, user, staff, row: data as Record<string, unknown> & { id: string; subject_id: string; data: DevelopmentPlanStructured } };
}

/**
 * Coach approval. Writes `approved_by_name` from the coach's OWN profile (the
 * one row they can read) and inserts the 'development_plan_shared' row the
 * player/parent RLS policies admit. The shared row holds only
 * toPlayerSafePlan()'s output, so the coach's private note and the verdict on
 * the previous plan never exist in a row a player can SELECT.
 *
 * Safe to call again: re-approving replaces the shared row rather than
 * stacking a second one, so a retry after a partial failure heals itself.
 */
export async function approveDevelopmentPlan(
  artefactId: string,
  options?: { acknowledgeWording?: boolean }
): Promise<{ success?: boolean; approvedByName?: string; error?: string; flagged?: boolean }> {
  try {
    const loaded = await loadOwnedPlan(artefactId);
    if ("error" in loaded) return { error: loaded.error };
    const { supabase, user, row } = loaded;

    // A last look at the words a child will read (lib/child-safe-check.ts). It
    // is an aid, not a verdict: the coach can edit the wording, or approve it
    // knowingly with `acknowledgeWording` once they have seen what was flagged.
    const flags = checkPlayerFacing(toPlayerSafePlan(row.data));
    if (flags.length > 0 && !options?.acknowledgeWording) {
      return {
        error: `Some of the wording may read as negative to a child (${describeFlags(flags)}). Edit it, or approve it as it is.`,
        flagged: true,
      };
    }

    const { data: me } = await supabase.from("profiles").select("full_name, academy_id").eq("id", user.id).single();
    const approverName = (me?.full_name as string | undefined) ?? "A coach";
    const approvedAt = new Date().toISOString();

    const { error: approveError } = await supabase
      .from("ai_artefacts")
      .update({ status: "approved", approved_by: user.id, approved_by_name: approverName, approved_at: approvedAt })
      .eq("id", row.id);
    if (approveError) return { error: "Couldn't approve the plan. Try again." };

    // Retire the previously shared plan for this player, then publish the new one.
    const { error: retireError } = await supabase
      .from("ai_artefacts")
      .update({ superseded_at: approvedAt })
      .eq("kind", "development_plan_shared")
      .eq("subject_type", "player")
      .eq("subject_id", row.subject_id)
      .is("superseded_at", null);
    if (retireError) return { error: "Couldn't publish the plan. Try again." };

    const safe = toPlayerSafePlan(row.data);
    const { error: shareError } = await supabase.from("ai_artefacts").insert({
      academy_id: row.academy_id,
      kind: "development_plan_shared",
      subject_type: "player",
      subject_id: row.subject_id,
      data: safe,
      prose: renderPlayerPlanProse(safe).replace(/\*/g, ""),
      model_id: row.model_id,
      inputs_fingerprint: row.inputs_fingerprint,
      status: "approved",
      approved_by: user.id,
      approved_by_name: approverName,
      approved_at: approvedAt,
      created_by: user.id,
    });
    if (shareError) return { error: "Couldn't publish the plan. Try again." };

    revalidatePath("/dashboard/player/development");
    revalidatePath("/dashboard/parent", "layout");
    return { success: true, approvedByName: approverName };
  } catch (err) {
    reportError(err, { scope: "approveDevelopmentPlan" });
    return { error: "Couldn't approve the plan. Try again." };
  }
}

/**
 * A coach edits the wording of a draft plan before approving it. Words only:
 * see lib/plan-edits.ts for what can and cannot change. An approved plan is not
 * edited in place, because the family may already be reading the shared copy;
 * the coach generates a new one instead.
 */
export async function saveDevelopmentPlanEdits(
  artefactId: string,
  edits: PlanEdits
): Promise<{ success?: boolean; plan?: string; error?: string }> {
  try {
    const loaded = await loadOwnedPlan(artefactId);
    if ("error" in loaded) return { error: loaded.error };
    const { supabase, row } = loaded;
    if (row.status === "approved") return { error: "This plan is already approved. Generate a new one to change it." };

    const result = applyPlanEdits(row.data, edits);
    if ("error" in result) return { error: result.error };

    const prose = renderDevelopmentPlanProse(result.plan).replace(/\*/g, "");
    const { error } = await supabase
      .from("ai_artefacts")
      .update({ data: result.plan, prose })
      .eq("id", row.id)
      .eq("status", "draft");
    if (error) return { error: "Couldn't save your changes. Try again." };

    revalidatePath("/dashboard/coach/squad/plans");
    return { success: true, plan: prose };
  } catch (err) {
    reportError(err, { scope: "saveDevelopmentPlanEdits" });
    return { error: "Couldn't save your changes. Try again." };
  }
}

export async function setDevelopmentPlanFeedback(
  artefactId: string,
  feedback: "helpful" | "not_helpful" | null
): Promise<{ success?: boolean; error?: string }> {
  try {
    const loaded = await loadOwnedPlan(artefactId);
    if ("error" in loaded) return { error: loaded.error };
    const { supabase, user, row } = loaded;

    const { error } = await supabase
      .from("ai_artefacts")
      .update(
        feedback
          ? { feedback, feedback_by: user.id, feedback_at: new Date().toISOString() }
          : { feedback: null, feedback_by: null, feedback_at: null }
      )
      .eq("id", row.id);
    if (error) return { error: "Couldn't save your feedback." };
    return { success: true };
  } catch (err) {
    reportError(err, { scope: "setDevelopmentPlanFeedback" });
    return { error: "Couldn't save your feedback." };
  }
}
