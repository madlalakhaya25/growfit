jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { thinkItThrough } from "../copilot";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const ITEM = { id: "i1", age_group: "U13", category: "technical", title: "Receive and turn under pressure", description: null, sort_order: 1, active: true };

function setup(opts: { profile?: unknown; items?: unknown[] } = {}) {
  const f = fakeSupabase((op) => (op.table === "curriculum_items" ? { data: opts.items ?? [ITEM] } : { data: null }));
  mockRequireStaff.mockResolvedValue({
    supabase: f.client, user: { id: "u1" },
    profile: "profile" in opts ? opts.profile : { id: "u1", role: "coach", academy_id: "ac" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
  mockGenerate.mockResolvedValue({ text: "POSSIBLE CAUSES\nThe midfield is too far from the back line.\n\nSESSION IDEAS\nReceive and turn under pressure." });
});

describe("thinkItThrough", () => {
  it("refuses a non-staff caller, an empty problem and a long one, without calling the model", async () => {
    setup({ profile: null });
    expect((await thinkItThrough({ problem: "x", ageGroup: "U13" })).error).toMatch(/Coaches and admins/);
    setup();
    expect((await thinkItThrough({ problem: "  ", ageGroup: "U13" })).error).toMatch(/Name the problem/);
    expect((await thinkItThrough({ problem: "x".repeat(400), ageGroup: "U13" })).error).toMatch(/a bit long/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("shows the model the problem, the age and the academy's curriculum titles, and returns sections", async () => {
    setup();
    const res = await thinkItThrough({ problem: "We bunch around the ball.", ageGroup: "U13" });
    expect(res.sections?.map((s) => s.key)).toEqual(["causes", "sessions"]);
    const sent = mockGenerate.mock.calls[0][0];
    expect(sent.contents).toContain("We bunch around the ball.");
    expect(sent.contents).toContain("AGE GROUP: U13");
    expect(sent.contents).toContain("- Receive and turn under pressure");
    expect(sent.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("says there is no curriculum when the age group has none, and when the team has no age", async () => {
    setup({ items: [] });
    await thinkItThrough({ problem: "p", ageGroup: "U13" });
    expect(mockGenerate.mock.calls[0][0].contents).toContain("none written yet");
    setup();
    await thinkItThrough({ problem: "p", ageGroup: "Senior" });
    expect(mockGenerate.mock.calls[1][0].contents).toContain("none written yet");
  });

  it("stops at the budget before any model call, and turns an unreadable answer into an error", async () => {
    setup();
    mockBudget.mockResolvedValueOnce("Too many requests.");
    expect((await thinkItThrough({ problem: "p", ageGroup: "U13" })).error).toBe("Too many requests.");
    expect(mockGenerate).not.toHaveBeenCalled();
    mockGenerate.mockResolvedValueOnce({ text: "I cannot help." });
    expect((await thinkItThrough({ problem: "p", ageGroup: "U13" })).error).toMatch(/Could not think/);
  });

  it("returns a friendly error when the model call throws", async () => {
    setup();
    mockGenerate.mockRejectedValue(new Error("boom"));
    expect((await thinkItThrough({ problem: "p", ageGroup: "U13" })).error).toBe("friendly");
  });
});
