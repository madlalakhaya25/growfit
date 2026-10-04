const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));
const mockGenerate = jest.fn();
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@google/genai", () => require("@/test-utils/genai-mock").genaiMock((...a: unknown[]) => mockGenerate(...a)));

import { interpretBoardInstructions } from "../board-instructions";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const params = { teamId: "t1", sentence: "left back overlaps", playersMenu: "0 = LB (Defender, left, defensive third)\n1 = LW (Forward, left, middle third)", count: 2 };
const reply = (o: unknown) => ({ text: JSON.stringify(o) });

function setup(team: unknown = { id: "t1", age_group: "U13" }) {
  const f = fakeSupabase((op) => (op.table === "teams" ? { data: team } : { data: null }));
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
});

describe("interpretBoardInstructions", () => {
  it("needs words, and not too many, before anything else happens", async () => {
    expect((await interpretBoardInstructions({ ...params, sentence: " " })).error).toMatch(/Tell the board/);
    expect((await interpretBoardInstructions({ ...params, sentence: "x".repeat(400) })).error).toMatch(/a bit long/);
    expect((await interpretBoardInstructions({ ...params, count: 0 })).error).toMatch(/players on the board/);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });
  it("refuses a team the caller doesn't coach, before spending budget", async () => {
    setup(null);
    expect(await interpretBoardInstructions(params)).toEqual({ error: "You don't coach this team." });
    expect(mockBudget).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("returns only validated instructions and counts what it dropped", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply({ instructions: [{ action: "overlap", player: 0, target: 1 }, { action: "teleport", player: 1 }, { action: "drop", player: 7 }] }));
    expect(await interpretBoardInstructions(params)).toEqual({ instructions: [{ action: "overlap", player: 0, target: 1 }], dropped: 2 });
  });
  it("sends words and the player list to the model, never asks for coordinates", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply({ instructions: [{ action: "drop", player: 1 }] }));
    await interpretBoardInstructions(params);
    const call = mockGenerate.mock.calls[0][0];
    expect(call.contents).toContain("left back overlaps");
    expect(call.contents).toContain("0 = LB");
    expect(call.contents).toContain("U13");
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(JSON.stringify(call.config.responseSchema)).not.toMatch(/"x"|"y"/);
  });
  it("reports a model answer with nothing usable, and a model failure, without throwing", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply({ instructions: [] }));
    expect((await interpretBoardInstructions(params)).error).toMatch(/Couldn't find a movement/);
    mockGenerate.mockRejectedValue(new Error("boom"));
    expect(await interpretBoardInstructions(params)).toEqual({ error: "friendly" });
  });
});
