/**
 * Tests the *behaviour* of the development-plan actions -- who is let in, when a
 * model call is and isn't made, and what gets written on approval -- against a
 * small in-memory stand-in for the database.
 *
 * What is mocked, and why: the Gemini SDK (its ESM build can't load under Jest
 * and we must not call it), next/cache (needs a Next request context), and the
 * auth boundary (`requireStaff` / `coachesPlayer`), whose own logic is covered
 * by auth-guards.test.ts. Nothing about the action's own decisions is mocked.
 */

const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER" },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));

const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockCoachesPlayer = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ coachesPlayer: (...a: unknown[]) => mockCoachesPlayer(...a) }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({
  aiError: (e: unknown) => `AI-ERROR: ${e instanceof Error ? e.message : String(e)}`,
  checkAiBudget: (...a: unknown[]) => mockBudget(...a),
}));

import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";
import { approveDevelopmentPlan, generateDevelopmentPlan, saveDevelopmentPlanEdits, setDevelopmentPlanFeedback } from "../development-plan";

type Op = FakeOp;
type Reply = FakeReply;

const PLAYER_ID = "p1";
const OPEN_TEMPLATE = { id: "t-open", title: "Strike a 15m pass", description: null, category: "technical", position: null, age_group: null, sort_order: 1 };
const GOOD_REPLY = {
  playerSummary: "A composed midfielder.",
  focusAreas: [{ category: "technical", area: "First touch", why: "It lets you keep the ball." }],
  actions: [{ what: "Wall passes", how: "50 a session", timesPerWeek: 3, measure: "40 clean", milestoneTemplateId: "t-open" }],
  coachNote: "Watch confidence.",
  playerNote: "Keep enjoying the ball.",
};
const coach = { supabase: null as unknown, user: { id: "coach-1" }, profile: { id: "coach-1", role: "coach", academy_id: "ac-1" } };

function db(opts: { liveArtefacts?: () => Record<string, unknown>[]; inserted?: Record<string, unknown>[] } = {}) {
  const inserted = opts.inserted ?? [];
  return fakeSupabase((op) => {
    switch (op.table) {
      case "players": return { data: { full_name: "Anelisa Ngidi", position: "CM", date_of_birth: "2014-01-01", academy_id: "ac-1" } };
      case "player_attributes": return { data: [{ passing: 70 }] };
      case "player_ratings": return { data: [{ rating: 4, created_at: "2026-09-20T10:00:00Z", fixtures: { opponent: "Umlazi" } }] };
      case "training_attendance": return { data: [{ status: "present" }, { status: "absent" }] };
      case "development_milestone_templates": return { data: [OPEN_TEMPLATE] };
      case "player_milestone_completions": return { data: [] };
      case "ai_artefacts":
        if (op.action === "select") return { data: opts.liveArtefacts ? opts.liveArtefacts() : [] };
        if (op.action === "update") return { data: null };
        if (op.action === "insert") {
          const row = { id: `a${inserted.length + 1}`, created_at: new Date().toISOString(), superseded_at: null, ...op.payload };
          inserted.push(row);
          return { data: row };
        }
        return {};
      default: return { data: null };
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBudget.mockResolvedValue(null);
  mockCoachesPlayer.mockResolvedValue(true);
  mockGenerate.mockResolvedValue({ text: JSON.stringify(GOOD_REPLY), usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200, thoughtsTokenCount: 0, totalTokenCount: 300 } });
  process.env.GEMINI_API_KEY = "test";
});

describe("generateDevelopmentPlan — the gate (Phase 0)", () => {
  it("a player gets an error and NO model call and NO budget spent", async () => {
    mockRequireStaff.mockResolvedValue({ supabase: db().client, user: { id: "u" }, profile: null });
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.error).toMatch(/coaches and admins only/);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBudget).not.toHaveBeenCalled();
  });

  it("a coach of a different team is refused, again with no model call and no budget spent", async () => {
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db().client });
    mockCoachesPlayer.mockResolvedValue(false);
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.error).toMatch(/don't coach this player/);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBudget).not.toHaveBeenCalled();
  });

  it("asks the guard about THIS player", async () => {
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db().client });
    await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(mockCoachesPlayer).toHaveBeenCalledWith(expect.anything(), { userId: "coach-1", role: "coach", playerId: PLAYER_ID });
  });
});

describe("generateDevelopmentPlan — generation and the cache", () => {
  it("generates, validates, and saves a DRAFT with provenance", async () => {
    const inserted: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted }).client });
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });

    expect(r.error).toBeUndefined();
    expect(r.cached).toBe(false);
    expect(r.persisted).toBe(true);
    expect(r.status).toBe("draft");
    expect(r.structured?.actions[0].milestoneTemplateId).toBe("t-open");
    expect(r.structured?.previous.verdict).toBe("no_previous_plan");
    expect(r.plan).toContain("FOCUS AREAS:");
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockBudget).toHaveBeenCalledTimes(1);

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      kind: "development_plan", subject_type: "player", subject_id: PLAYER_ID, status: "draft",
      academy_id: "ac-1", created_by: "coach-1", total_tokens: 300, output_tokens: 200, prompt_tokens: 100,
    });
    expect(inserted[0].inputs_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("asks the model for structured JSON with thinking off and a budget big enough not to truncate", async () => {
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db().client });
    await generateDevelopmentPlan({ playerId: PLAYER_ID });
    const { config } = mockGenerate.mock.calls[0][0];
    expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(config.maxOutputTokens).toBeGreaterThanOrEqual(1400);
    expect(config.responseMimeType).toBe("application/json");
    // no previous plan -> the model isn't asked to judge one
    expect(config.responseSchema.properties.previous).toBeUndefined();
    expect(config.systemInstruction).toMatch(/never name a weakness/);
  });

  it("a second call with nothing changed is a CACHE HIT: no model call, no budget spent", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    const client = db({ inserted, liveArtefacts: () => live }).client;
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });

    await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(mockGenerate).toHaveBeenCalledTimes(1);

    live = [inserted[0]]; // the plan just saved is now the live one
    const second = await generateDevelopmentPlan({ playerId: PLAYER_ID });

    expect(second.cached).toBe(true);
    expect(second.artefactId).toBe("a1");
    expect(second.structured?.playerNote).toBe("Keep enjoying the ball.");
    expect(mockGenerate).toHaveBeenCalledTimes(1); // still one
    expect(mockBudget).toHaveBeenCalledTimes(1); // still one
    expect(inserted).toHaveLength(1); // nothing new saved
  });

  it("force regenerates even when nothing changed, and the previous plan is shown to the model", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted, liveArtefacts: () => live }).client });

    await generateDevelopmentPlan({ playerId: PLAYER_ID });
    live = [inserted[0]];
    mockGenerate.mockResolvedValueOnce({
      text: JSON.stringify({ ...GOOD_REPLY, previous: { verdict: "partly", evidence: "Ratings steady.", carriedForward: ["First touch"] } }),
    });
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID, force: true });

    expect(r.cached).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    const second = mockGenerate.mock.calls[1][0];
    expect(second.contents).toContain("PREVIOUS PLAN");
    expect(second.config.responseSchema.properties.previous).toBeDefined();
    expect(r.structured?.previous.verdict).toBe("partly");
    expect(inserted).toHaveLength(2);
    // ...and generating plan 2 did not change the cache key (the design flaw this guards against)
    expect(inserted[1].inputs_fingerprint).toBe(inserted[0].inputs_fingerprint);
  });

  it("a stored plan from a DIFFERENT model is not served", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted, liveArtefacts: () => live }).client });
    await generateDevelopmentPlan({ playerId: PLAYER_ID });
    live = [{ ...inserted[0], model_id: "some-older-model" }];
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.cached).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("a model reply that can't be used is an error, not a saved plan", async () => {
    const inserted: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted }).client });
    mockGenerate.mockResolvedValueOnce({ text: '{"playerSummary": "cut off mid-' });
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.error).toMatch(/Could not read the AI's plan/);
    expect(inserted).toHaveLength(0);
  });

  it("over budget: returns the budget message and makes no model call", async () => {
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db().client });
    mockBudget.mockResolvedValueOnce("Too many requests.");
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.error).toBe("Too many requests.");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("never plans from a pathway that failed to load", async () => {
    const client = fakeSupabase((op) => {
      if (op.table === "development_milestone_templates") return { error: { code: "42501", message: "denied" } };
      if (op.table === "players") return { data: { full_name: "A", position: "CM", date_of_birth: null } };
      return { data: [] };
    }).client;
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.error).toMatch(/Couldn't load development milestones/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("when migration 045 is missing the plan is still returned, flagged as not persisted", async () => {
    const client = fakeSupabase((op) => {
      if (op.table === "ai_artefacts") return { error: { code: "PGRST205", message: "no table" } };
      return db().calls && (({
        players: { data: { full_name: "A", position: "CM", date_of_birth: null } },
        player_attributes: { data: [] }, player_ratings: { data: [] }, training_attendance: { data: [] },
        development_milestone_templates: { data: [OPEN_TEMPLATE] }, player_milestone_completions: { data: [] },
      } as Record<string, Reply>)[op.table] ?? { data: [] });
    }).client;
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    const r = await generateDevelopmentPlan({ playerId: PLAYER_ID });
    expect(r.error).toBeUndefined();
    expect(r.persisted).toBe(false);
    expect(r.artefactId).toBeUndefined();
    expect(r.plan).toBeTruthy();
  });
});

describe("approveDevelopmentPlan", () => {
  const planRow = {
    id: "a1", kind: "development_plan", subject_id: PLAYER_ID, academy_id: "ac-1", superseded_at: null,
    model_id: "m", inputs_fingerprint: "f",
    data: {
      playerSummary: "S", focusAreas: [{ category: "technical", area: "A", why: "W" }],
      actions: [{ what: "X", how: "Y", timesPerWeek: 2, measure: "M", milestoneTemplateId: null }],
      reviewDate: "2026-10-30",
      previous: { verdict: "not_yet", evidence: "PRIVATE-EVIDENCE", carriedForward: [] },
      coachNote: "PRIVATE-NOTE", playerNote: "Keep going.",
    },
  };

  function approveDb(row: Record<string, unknown> | null) {
    const writes: Op[] = [];
    const f = fakeSupabase((op) => {
      if (op.table === "ai_artefacts" && op.action === "select") return { data: row };
      if (op.table === "profiles") return { data: { full_name: "Sphe Mlotshwa", academy_id: "ac-1" } };
      if (op.action !== "select") writes.push(op);
      return { data: null };
    });
    return { client: f.client, writes };
  }

  it("publishes a SECOND row holding only the player-safe fields — no coachNote, no previous", async () => {
    const { client, writes } = approveDb(planRow);
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    const r = await approveDevelopmentPlan("a1");

    expect(r).toEqual({ success: true, approvedByName: "Sphe Mlotshwa" });
    const insert = writes.find((w) => w.action === "insert")!;
    expect(insert.payload).toMatchObject({
      kind: "development_plan_shared", subject_id: PLAYER_ID, status: "approved", approved_by_name: "Sphe Mlotshwa",
    });
    const stored = JSON.stringify(insert.payload);
    expect(stored).not.toContain("PRIVATE");
    expect(stored).not.toContain("coachNote");
    expect(stored).not.toContain("previous");
    expect((insert.payload!.data as Record<string, unknown>).playerNote).toBe("Keep going.");
  });

  it("marks the coach's own row approved with the approver's NAME denormalised", async () => {
    const { client, writes } = approveDb(planRow);
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    await approveDevelopmentPlan("a1");
    const approve = writes.find((w) => w.action === "update" && w.payload?.status === "approved")!;
    expect(approve.payload).toMatchObject({ status: "approved", approved_by: "coach-1", approved_by_name: "Sphe Mlotshwa" });
  });

  it("retires the previously shared plan before publishing the new one", async () => {
    const { client, writes } = approveDb(planRow);
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    await approveDevelopmentPlan("a1");
    const kinds = writes.map((w) => w.action);
    expect(kinds.indexOf("update", 1)).toBeGreaterThan(-1);
    expect(writes.findIndex((w) => w.action === "update" && w.payload?.superseded_at)).toBeLessThan(
      writes.findIndex((w) => w.action === "insert")
    );
  });

  it.each([
    ["a player", { profile: null }, true, /coaches and admins only/],
    ["a coach of another team", {}, false, /don't coach this player/],
  ])("refuses %s and writes nothing", async (_n, override, owns, message) => {
    const { client, writes } = approveDb(planRow);
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client, ...override });
    mockCoachesPlayer.mockResolvedValue(owns);
    const r = await approveDevelopmentPlan("a1");
    expect(r.error).toMatch(message);
    expect(writes).toHaveLength(0);
  });

  it("refuses a plan that no longer exists or has been replaced", async () => {
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: approveDb(null).client });
    expect((await approveDevelopmentPlan("gone")).error).toMatch(/no longer exists/);
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: approveDb({ ...planRow, superseded_at: "2026-10-01T00:00:00Z" }).client });
    expect((await approveDevelopmentPlan("a1")).error).toMatch(/newer plan/);
  });
});

describe("approving wording a child may read as negative", () => {
  const row = (playerNote: string) => ({
    id: "a1", kind: "development_plan", subject_id: PLAYER_ID, academy_id: "ac-1", superseded_at: null, model_id: "m", inputs_fingerprint: "f",
    data: {
      playerSummary: "S", focusAreas: [{ category: "technical", area: "A", why: "W" }],
      actions: [{ what: "X", how: "Y", timesPerWeek: 2, measure: "M", milestoneTemplateId: null }],
      reviewDate: "2026-10-30", previous: { verdict: "no_previous_plan", evidence: "", carriedForward: [] },
      coachNote: "", playerNote,
    },
  });
  function dbFor(r: Record<string, unknown>) {
    const writes: Op[] = [];
    const f = fakeSupabase((op) => {
      if (op.table === "ai_artefacts" && op.action === "select") return { data: r };
      if (op.table === "profiles") return { data: { full_name: "Sphe", academy_id: "ac-1" } };
      if (op.action !== "select") writes.push(op);
      return { data: null };
    });
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: f.client });
    mockCoachesPlayer.mockResolvedValue(true);
    return writes;
  }

  it("stops, names the wording, and writes nothing", async () => {
    const writes = dbFor(row("Your passing is poor."));
    const r = await approveDevelopmentPlan("a1");
    expect(r.flagged).toBe(true);
    expect(r.error).toMatch(/note to the player: "poor"/);
    expect(writes).toHaveLength(0);
  });

  it("approves it once the coach has seen the flag and says so", async () => {
    const writes = dbFor(row("Your passing is poor."));
    const r = await approveDevelopmentPlan("a1", { acknowledgeWording: true });
    expect(r).toEqual({ success: true, approvedByName: "Sphe" });
    expect(writes.some((w) => w.action === "insert")).toBe(true);
  });

  it("approves warm wording without being asked", async () => {
    dbFor(row("Keep enjoying the ball."));
    expect((await approveDevelopmentPlan("a1")).success).toBe(true);
  });
});

describe("saveDevelopmentPlanEdits", () => {
  const draft = {
    id: "a1", kind: "development_plan", subject_id: PLAYER_ID, academy_id: "ac-1", superseded_at: null, status: "draft",
    data: {
      playerSummary: "S", focusAreas: [{ category: "technical", area: "A", why: "W" }],
      actions: [{ what: "X", how: "Y", timesPerWeek: 2, measure: "M", milestoneTemplateId: null }],
      reviewDate: "2026-10-30", previous: { verdict: "no_previous_plan", evidence: "", carriedForward: [] },
      coachNote: "PRIVATE", playerNote: "Keep going.",
    },
  };
  function dbFor(r: Record<string, unknown> | null) {
    const writes: Op[] = [];
    const f = fakeSupabase((op) => {
      if (op.table === "ai_artefacts" && op.action === "select") return { data: r };
      if (op.action !== "select") writes.push(op);
      return { data: null };
    });
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: f.client });
    mockCoachesPlayer.mockResolvedValue(true);
    return writes;
  }

  it("writes the edited wording to the draft and keeps the coach's private note", async () => {
    const writes = dbFor(draft);
    const r = await saveDevelopmentPlanEdits("a1", { playerNote: "Well done this term." });
    expect(r.success).toBe(true);
    const update = writes.find((w) => w.action === "update")!;
    expect((update.payload!.data as Record<string, unknown>).playerNote).toBe("Well done this term.");
    expect((update.payload!.data as Record<string, unknown>).coachNote).toBe("PRIVATE");
  });

  it("refuses to edit a plan that is already approved, and writes nothing", async () => {
    const writes = dbFor({ ...draft, status: "approved" });
    const r = await saveDevelopmentPlanEdits("a1", { playerNote: "Changed" });
    expect(r.error).toMatch(/already approved/);
    expect(writes).toHaveLength(0);
  });

  it("refuses a coach who does not coach this player, and an empty note", async () => {
    let writes = dbFor(draft);
    mockCoachesPlayer.mockResolvedValue(false);
    expect((await saveDevelopmentPlanEdits("a1", { playerNote: "x" })).error).toMatch(/don't coach this player/);
    expect(writes).toHaveLength(0);
    writes = dbFor(draft);
    expect((await saveDevelopmentPlanEdits("a1", { playerNote: "  " })).error).toMatch(/can't be empty/);
    expect(writes).toHaveLength(0);
  });
});

describe("setDevelopmentPlanFeedback", () => {
  it("records who and when, and clears all three on null", async () => {
    const writes: Op[] = [];
    const client = fakeSupabase((op) => {
      if (op.table === "ai_artefacts" && op.action === "select") return { data: { id: "a1", subject_id: PLAYER_ID, superseded_at: null } };
      if (op.action !== "select") writes.push(op);
      return {};
    }).client;
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    expect(await setDevelopmentPlanFeedback("a1", "helpful")).toEqual({ success: true });
    expect(writes[0].payload).toMatchObject({ feedback: "helpful", feedback_by: "coach-1" });
    expect(writes[0].payload!.feedback_at).toEqual(expect.any(String));
    await setDevelopmentPlanFeedback("a1", null);
    expect(writes[1].payload).toEqual({ feedback: null, feedback_by: null, feedback_at: null });
  });

  it("is refused for someone who doesn't coach the player", async () => {
    const client = fakeSupabase((op) => (op.action === "select" ? { data: { id: "a1", subject_id: PLAYER_ID, superseded_at: null } } : {})).client;
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: client });
    mockCoachesPlayer.mockResolvedValue(false);
    expect((await setDevelopmentPlanFeedback("a1", "helpful")).error).toMatch(/don't coach this player/);
  });
});
