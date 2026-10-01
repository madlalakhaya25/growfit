/**
 * The two actions adopted onto the artefact store in Step 1.8. What matters and
 * is tested here: they are still gated (Phase 0), a stored result is served
 * with no model call and no budget spent, and a changed input is not served stale.
 * See development-plan.test.ts for what is mocked and why.
 */
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
  Type: {},
}));
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

import { getPlayerInsights } from "../ai-insights";
import { generateAcademyHealthReport } from "../academy-health";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const coach = { user: { id: "coach-1" }, profile: { id: "coach-1", role: "coach", academy_id: "ac-1" } };

function db(opts: { live?: () => Record<string, unknown>[]; inserted?: Record<string, unknown>[]; ratings?: unknown[] } = {}) {
  const inserted = opts.inserted ?? [];
  return fakeSupabase((op) => {
    switch (op.table) {
      case "players":
        return op.one
          ? { data: { full_name: "Anelisa Ngidi", position: "CM", date_of_birth: "2014-01-01" } }
          : { data: [{ id: "p1", position: "CM" }] };
      case "player_ratings": return { data: opts.ratings ?? [{ rating: 4, note: null, created_at: "2026-09-20T10:00:00Z", fixtures: { opponent: "Umlazi" } }] };
      case "player_attributes": return { data: [{ passing: 70 }] };
      case "player_milestone_completions": return { data: [] };
      case "ai_artefacts":
        if (op.action === "select") return { data: opts.live ? opts.live() : [] };
        if (op.action === "update") return { data: null };
        { const row = { id: `a${inserted.length + 1}`, created_at: new Date().toISOString(), superseded_at: null, ...op.payload }; inserted.push(row); return { data: row }; }
      default: return { data: [] };
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBudget.mockResolvedValue(null);
  mockCoachesPlayer.mockResolvedValue(true);
  mockGenerate.mockResolvedValue({ text: "STRENGTHS: - good *bold*", usageMetadata: { totalTokenCount: 99 } });
  process.env.GEMINI_API_KEY = "test";
});

describe("getPlayerInsights", () => {
  it("refuses a player and a coach of another team before any query, model call or budget spend", async () => {
    mockRequireStaff.mockResolvedValue({ user: { id: "u" }, profile: null, supabase: db().client });
    expect((await getPlayerInsights("p1")).error).toMatch(/coaches and admins only/);

    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db().client });
    mockCoachesPlayer.mockResolvedValue(false);
    expect((await getPlayerInsights("p1")).error).toMatch(/don't coach this player/);

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBudget).not.toHaveBeenCalled();
  });

  it("generates, strips markdown asterisks, and stores it as player_insights", async () => {
    const inserted: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted }).client });
    const r = await getPlayerInsights("p1");
    expect(r.insights).toBe("STRENGTHS: - good bold");
    expect(r).toMatchObject({ cached: false, persisted: true, artefactId: "a1" });
    expect(inserted[0]).toMatchObject({ kind: "player_insights", subject_type: "player", subject_id: "p1", total_tokens: 99 });
  });

  it("a second call with nothing changed is served from storage: no model call, no budget", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted, live: () => live }).client });
    await getPlayerInsights("p1");
    live = [inserted[0]];

    const r = await getPlayerInsights("p1");
    expect(r).toMatchObject({ cached: true, insights: "STRENGTHS: - good bold" });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockBudget).toHaveBeenCalledTimes(1);
  });

  it("a new rating changes the brief, so the stored insight is NOT served", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    const rows: Record<string, unknown>[] = [{ rating: 4, note: null, created_at: "2026-09-20T10:00:00Z", fixtures: { opponent: "Umlazi" } }];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted, live: () => live, ratings: rows }).client });
    await getPlayerInsights("p1");
    live = [inserted[0]];

    rows.unshift({ rating: 2, note: "Tired", created_at: "2026-09-27T10:00:00Z", fixtures: { opponent: "Chatsworth" } });
    const r = await getPlayerInsights("p1");
    expect(r.cached).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("force regenerates; over budget refuses before the model", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted, live: () => live }).client });
    await getPlayerInsights("p1");
    live = [inserted[0]];
    expect((await getPlayerInsights("p1", { force: true })).cached).toBe(false);
    expect(mockGenerate).toHaveBeenCalledTimes(2);

    mockBudget.mockResolvedValueOnce("Too many requests.");
    expect((await getPlayerInsights("p1", { force: true })).error).toBe("Too many requests.");
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });
});

describe("generateAcademyHealthReport", () => {
  it("refuses a non-staff caller with no model call and no budget spend", async () => {
    mockRequireStaff.mockResolvedValue({ user: { id: "u" }, profile: null, supabase: db().client });
    expect((await generateAcademyHealthReport()).error).toMatch(/coaches and admins only/);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBudget).not.toHaveBeenCalled();
  });

  it("stores the report against the academy, and a repeat is served free", async () => {
    const inserted: Record<string, unknown>[] = [];
    let live: Record<string, unknown>[] = [];
    mockRequireStaff.mockResolvedValue({ ...coach, supabase: db({ inserted, live: () => live }).client });

    const first = await generateAcademyHealthReport();
    expect(first.report).toBeTruthy();
    expect(inserted[0]).toMatchObject({ kind: "academy_health", subject_type: "academy", subject_id: "ac-1", academy_id: "ac-1" });

    live = [inserted[0]];
    const second = await generateAcademyHealthReport();
    expect(second.cached).toBe(true);
    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockBudget).toHaveBeenCalledTimes(1);
  });
});
