const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER" },
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { generateSessionFromBoard } from "../board-to-session";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const drill = (name: string) => ({
  name, durationMinutes: 10, ltpdFocus: "Passing", fourCorner: "Technical",
  setup: "20x15m", instructions: "1. Pass.", coachingPoints: "Open body",
});
const reply = (drills: unknown[]) => ({ text: JSON.stringify({ drills, coachReflection: "What changed?" }) });
const params = { teamId: "t1", playName: "High press", conceptLabels: ["Pressing"], summary: "Our players (3)..." };

function setup(team: unknown = { id: "t1", age_group: "U13" }) {
  const f = fakeSupabase((op) => (op.table === "teams" ? { data: team } : { data: null }));
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
});

describe("generateSessionFromBoard", () => {
  it("refuses a team the caller doesn't coach, before spending budget", async () => {
    setup(null);
    expect(await generateSessionFromBoard(params)).toEqual({ error: "You don't coach this team." });
    expect(mockBudget).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("needs a board description", async () => {
    setup();
    expect((await generateSessionFromBoard({ ...params, summary: "  " })).error).toMatch(/players on the board/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("returns the budget message when over budget", async () => {
    setup();
    mockBudget.mockResolvedValue("slow down");
    expect(await generateSessionFromBoard(params)).toEqual({ error: "slow down" });
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("builds a three-drill session from the board, pitched at the team's own age group", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply([drill("Unopposed"), drill("Opposed"), drill("SSG")]));
    const res = await generateSessionFromBoard(params);
    expect(res.structured?.drills).toHaveLength(3);
    expect(res.plan).toContain("DRILL 3: SSG (10 min)");
    const call = mockGenerate.mock.calls[0][0];
    expect(call.contents).toContain("U13");
    expect(call.contents).toContain("Our players (3)");
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("says so when the model's answer has no usable progression", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply([drill("Only one")]));
    expect((await generateSessionFromBoard(params)).error).toMatch(/Could not read/);
  });
  it("shows only the friendly message when the model fails", async () => {
    setup();
    mockGenerate.mockRejectedValue(new Error("secret provider detail"));
    expect(await generateSessionFromBoard(params)).toEqual({ error: "friendly" });
  });
});
