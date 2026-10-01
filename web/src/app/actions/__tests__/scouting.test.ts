jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: async () => null, aiError: () => "friendly" }));
const mockMemory = jest.fn();
jest.mock("@/lib/opponent-memory-data", () => ({ loadOpponentMemory: (...a: unknown[]) => mockMemory(...a) }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { generateScoutingReport, NO_SCOUTING_HISTORY } from "../scouting";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const meeting = { fixtureId: "f0", date: "2026-03-01T10:00:00Z", isHome: true, score: { team: 2, opponent: 1 }, notes: null };

function setup(over: { team?: unknown; fixture?: unknown } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const f = fakeSupabase((op) => {
    if (op.table === "teams") return { data: "team" in over ? over.team : { id: "t1", name: "U13", academy_id: "ac" } };
    if (op.table === "fixtures") return { data: "fixture" in over ? over.fixture : { id: "fx1", opponent: "Rovers" } };
    if (op.table === "ai_artefacts" && op.action === "insert") { inserts.push(op.payload!); return { data: { id: "art1", created_at: "2026-10-01T00:00:00Z" } }; }
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return { inserts };
}

beforeEach(() => { jest.clearAllMocks(); process.env.GEMINI_API_KEY = "k"; });

describe("generateScoutingReport", () => {
  it("refuses a team the caller doesn't coach, before reading anything about the opponent", async () => {
    setup({ team: null });
    expect(await generateScoutingReport({ teamId: "t9", fixtureId: "fx1" })).toEqual({ error: "You don't coach this team." });
    expect(mockMemory).not.toHaveBeenCalled();
  });
  it("refuses a fixture that isn't this team's", async () => {
    setup({ fixture: null });
    expect(await generateScoutingReport({ teamId: "t1", fixtureId: "other" })).toEqual({ error: "Fixture not found." });
  });
  it("says so and makes no model call when nothing is logged", async () => {
    setup();
    mockMemory.mockResolvedValue({ meetings: [], formations: [] });
    const res = await generateScoutingReport({ teamId: "t1", fixtureId: "fx1" });
    expect(res).toMatchObject({ text: NO_SCOUTING_HISTORY, noHistory: true, persisted: false });
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("generates from the logged history and stores a scouting_report for the fixture", async () => {
    const { inserts } = setup();
    mockMemory.mockResolvedValue({ meetings: [meeting], formations: [] });
    mockGenerate.mockResolvedValue({ text: "WHAT WE KNOW\nWe won 2-1." });
    const res = await generateScoutingReport({ teamId: "t1", fixtureId: "fx1" });
    expect(res.text).toContain("We won 2-1.");
    expect(mockGenerate.mock.calls[0][0].contents).toContain("2-1");
    expect(inserts[0]).toMatchObject({ kind: "scouting_report", subject_type: "fixture", subject_id: "fx1", academy_id: "ac" });
  });
  it("shows only the friendly message when the model fails", async () => {
    setup();
    mockMemory.mockResolvedValue({ meetings: [meeting], formations: [] });
    mockGenerate.mockRejectedValue(new Error("secret provider detail"));
    expect(await generateScoutingReport({ teamId: "t1", fixtureId: "fx1" })).toEqual({ error: "friendly" });
  });
});
