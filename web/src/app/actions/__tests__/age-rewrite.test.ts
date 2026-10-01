jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { rewriteForAge } from "../age-rewrite";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { AI_MODEL_LITE } from "@/lib/ai-models";
import { fingerprintBrief } from "@/lib/ai-artefacts";
import { rewriteBrief, rewriteSubjectId } from "@/lib/age-rewrite";

const NOTE = "Training moves to 17:00 on Friday 12 Oct. Bring a water bottle.";

function setup(opts: { stored?: Record<string, unknown> | null; profile?: unknown } = {}) {
  const inserts: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    if (op.table === "ai_artefacts" && op.action === "select") return { data: opts.stored ? [opts.stored] : [] };
    if (op.table === "ai_artefacts" && op.action === "insert") { inserts.push(op); return { data: { id: "a1", created_at: "2026-10-01T00:00:00Z" } }; }
    return { data: null };
  });
  mockRequireStaff.mockResolvedValue({
    supabase: f.client, user: { id: "u1" },
    profile: "profile" in opts ? opts.profile : { id: "u1", role: "coach", academy_id: "ac" },
  });
  return { inserts };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
  mockGenerate.mockResolvedValue({ text: "Training is now at 17:00 on Friday 12 Oct. Please bring a water bottle." });
});

describe("rewriteForAge", () => {
  it("refuses anyone who isn't staff, an empty or huge note, and a team with no age", async () => {
    setup({ profile: null });
    expect((await rewriteForAge({ text: NOTE, ageGroup: "U11" })).error).toMatch(/Coaches and admins/);
    setup();
    expect((await rewriteForAge({ text: "  ", ageGroup: "U11" })).error).toMatch(/Write the message/);
    expect((await rewriteForAge({ text: "x".repeat(2000), ageGroup: "U11" })).error).toMatch(/a bit long/);
    expect((await rewriteForAge({ text: NOTE, ageGroup: "Senior" })).error).toMatch(/no age group/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("rewrites on the light model for the age, and stores it as an age_rewrite keyed on the text", async () => {
    const { inserts } = setup();
    const res = await rewriteForAge({ text: NOTE, ageGroup: "U11" });
    expect(res).toMatchObject({ text: expect.stringContaining("17:00"), cached: false });
    expect(res.missing).toBeUndefined();
    const call = mockGenerate.mock.calls[0][0];
    expect(call.model).toBe(AI_MODEL_LITE);
    expect(call.contents).toContain("11-year-old");
    expect(call.config.systemInstruction).toMatch(/never name a weakness/);
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(inserts[0].payload).toMatchObject({
      kind: "age_rewrite", subject_type: "text", subject_id: rewriteSubjectId(NOTE, 11), academy_id: "ac",
    });
  });
  it("serves the same note for the same age from the store, free", async () => {
    setup({
      stored: {
        id: "a9", kind: "age_rewrite", subject_type: "text", subject_id: rewriteSubjectId(NOTE, 11), data: { text: "Stored." }, prose: "Stored 17:00 12 Oct.",
        model_id: AI_MODEL_LITE, inputs_fingerprint: fingerprintBrief(rewriteBrief(NOTE, 11)), status: "draft",
        superseded_at: null, created_at: new Date().toISOString(), created_by: "u1",
      },
    });
    const res = await rewriteForAge({ text: NOTE, ageGroup: "U11" });
    expect(res).toMatchObject({ cached: true, text: "Stored 17:00 12 Oct." });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBudget).not.toHaveBeenCalled();
  });
  it("calls out a figure the rewrite dropped", async () => {
    setup();
    mockGenerate.mockResolvedValue({ text: "Training is later on Friday. Bring water." });
    const res = await rewriteForAge({ text: NOTE, ageGroup: "U11" });
    expect(res.missing).toEqual(["17:00", "12"]);
  });
  it("passes on an over-budget message and never leaks provider text", async () => {
    setup();
    mockBudget.mockResolvedValue("slow down");
    expect(await rewriteForAge({ text: NOTE, ageGroup: "U11" })).toEqual({ error: "slow down" });
    mockBudget.mockResolvedValue(null);
    mockGenerate.mockRejectedValue(new Error("secret"));
    expect(await rewriteForAge({ text: NOTE, ageGroup: "U11" })).toEqual({ error: "friendly" });
  });
  it("won't show an empty rewrite", async () => {
    setup();
    mockGenerate.mockResolvedValue({ text: "  " });
    expect((await rewriteForAge({ text: NOTE, ageGroup: "U11" })).error).toMatch(/Could not simplify/);
  });
});
