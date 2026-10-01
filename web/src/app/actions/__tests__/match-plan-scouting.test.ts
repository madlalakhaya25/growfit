jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: async () => null, aiError: () => "friendly" }));
jest.mock("@/lib/assistant-context", () => ({ getAssistantContext: jest.fn() }));
jest.mock("../squad-context", () => ({
  buildSquadContext: async () => ({ context: { brief: "BRIEF", stableBrief: "S", volatileBrief: "V", teamName: "U13", ageGroup: "U13", academyId: "a", teamId: "t1", playerCount: 1 } }),
}));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: { OBJECT: "OBJECT", STRING: "STRING", ARRAY: "ARRAY" },
  GoogleGenAI: class { caches = {}; models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { generateMatchPlan } from "../coach-assistant";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const plan = JSON.stringify({
  planSummary: "p", shapeAndWhy: "s", inPossession: [], outOfPossession: [],
  setPieces: { attacking: "a", defending: "d" }, keyPlayers: [], worries: [], teamTalk: [], rehearseAtTraining: "r",
});
const row = (over: Record<string, unknown> = {}) => ({
  id: "art", kind: "scouting_report", subject_type: "fixture", subject_id: "fx1", data: { text: "SCOUT-TEXT" }, prose: "SCOUT-TEXT",
  model_id: "m", inputs_fingerprint: "x", status: "draft", superseded_at: null, created_at: new Date().toISOString(),
  approved_by: null, approved_by_name: null, approved_at: null, feedback: null, feedback_by: null, feedback_at: null,
  prompt_tokens: null, output_tokens: null, thinking_tokens: null, total_tokens: null, ...over,
});

function setup(artefact: unknown) {
  const f = fakeSupabase((op) => (op.table === "ai_artefacts" ? { data: artefact ? [artefact] : [] } : { data: null }));
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  mockGenerate.mockResolvedValue({ text: plan });
}
const prompt = () => mockGenerate.mock.calls[0][0].contents as string;

beforeEach(() => { jest.clearAllMocks(); process.env.GEMINI_API_KEY = "k"; });

describe("generateMatchPlan with a stored scouting report", () => {
  it("includes a fresh report in the plan's brief", async () => {
    setup(row());
    expect(await generateMatchPlan({ teamId: "t1", fixtureId: "fx1" })).toMatchObject({ plan: expect.any(String) });
    expect(prompt()).toContain("SCOUTING REPORT");
    expect(prompt()).toContain("SCOUT-TEXT");
  });
  it("leaves it out when stale, superseded or absent", async () => {
    setup(row({ created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }));
    await generateMatchPlan({ teamId: "t1", fixtureId: "fx1" });
    expect(prompt()).not.toContain("SCOUTING REPORT");
    jest.clearAllMocks();
    setup(row({ superseded_at: new Date().toISOString() }));
    await generateMatchPlan({ teamId: "t1", fixtureId: "fx1" });
    expect(prompt()).not.toContain("SCOUTING REPORT");
    jest.clearAllMocks();
    setup(null);
    await generateMatchPlan({ teamId: "t1", fixtureId: "fx1" });
    expect(prompt()).not.toContain("SCOUTING REPORT");
  });
});
