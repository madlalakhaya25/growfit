jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));
const mockSavePlay = jest.fn();
jest.mock("../tactic-plays", () => ({ savePlay: (...a: unknown[]) => mockSavePlay(...a) }));

import { generateBoardFromSentence } from "../board-from-text";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const team = {
  id: "t1", age_group: "U13",
  team_members: [{ active: true, players: { id: "p1", full_name: "Sipho Dlamini", position: "lb" } }],
};
const reply = (o: unknown) => ({ text: JSON.stringify(o) });
const good = { formationId: "11-4-3-3", name: "High press", shapes: [{ kind: "run", fromSlot: 1, to: { x: 10, y: 40 } }] };
const params = { teamId: "t1", sentence: "4-3-3, press high", squadSize: 11 };

function setup(t: unknown = team) {
  const f = fakeSupabase((op) => (op.table === "teams" ? { data: t } : { data: null }));
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
  mockSavePlay.mockResolvedValue({ id: "play-1" });
});

describe("generateBoardFromSentence", () => {
  it("needs a sentence, and not a novel, before anything else happens", async () => {
    expect((await generateBoardFromSentence({ ...params, sentence: "  " })).error).toMatch(/Describe the play/);
    expect((await generateBoardFromSentence({ ...params, sentence: "x".repeat(400) })).error).toMatch(/too long|a bit long/);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });
  it("refuses a team the caller doesn't coach, before spending budget", async () => {
    setup(null);
    expect(await generateBoardFromSentence(params)).toEqual({ error: "You don't coach this team." });
    expect(mockBudget).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("saves the board as a NEW play: no playId, tokens from the roster, the formation recorded", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply(good));
    const res = await generateBoardFromSentence(params);
    expect(res).toEqual({ playId: "play-1", name: "High press", dropped: 0 });
    const arg = mockSavePlay.mock.calls[0][0];
    expect(arg.playId).toBeUndefined();
    expect(arg.teamId).toBe("t1");
    expect(arg.data.homeFormationId).toBe("11-4-3-3");
    expect(arg.data.tokens).toHaveLength(11);
    expect(arg.data.tokens.some((t: { playerId?: string }) => t.playerId === "p1")).toBe(true);
    expect(arg.data.shapes).toHaveLength(1);
  });
  it("sends the sentence, the board size and the team's age group to the model", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply(good));
    await generateBoardFromSentence(params);
    const call = mockGenerate.mock.calls[0][0];
    expect(call.contents).toContain("4-3-3, press high");
    expect(call.contents).toContain("11-a-side");
    expect(call.contents).toContain("U13");
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("saves nothing when the formation is the wrong size for the board", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply({ ...good, formationId: "7-2-3-1" }));
    const res = await generateBoardFromSentence(params);
    expect(res.error).toMatch(/7-a-side/);
    expect(mockSavePlay).not.toHaveBeenCalled();
  });
  it("reports how many parts of the sentence couldn't be drawn", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply({ ...good, shapes: [...good.shapes, { kind: "laser", fromSlot: 1, to: { x: 1, y: 1 } }] }));
    expect((await generateBoardFromSentence(params)).dropped).toBe(1);
  });
  it("passes on a save failure and a model failure without leaking detail", async () => {
    setup();
    mockGenerate.mockResolvedValue(reply(good));
    mockSavePlay.mockResolvedValue({ error: "Name is too long." });
    expect(await generateBoardFromSentence(params)).toEqual({ error: "Name is too long." });
    mockGenerate.mockRejectedValue(new Error("secret provider detail"));
    expect(await generateBoardFromSentence(params)).toEqual({ error: "friendly" });
  });
  it("refuses a board size that isn't a real format", async () => {
    expect((await generateBoardFromSentence({ ...params, squadSize: 8 })).error).toMatch(/formation/);
  });
});
