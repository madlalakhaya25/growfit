const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: async () => null, aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER" },
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { generateSessionPlan } from "../session-generator";

const drill = (n: number) => ({
  name: `Drill ${n}`, durationMinutes: 10, ltpdFocus: "x", fourCorner: "Technical", setup: "s", instructions: "i", coachingPoints: "c",
});
const base = { ageGroup: "U13", sessionType: "general", focusArea: "Pressing", durationMinutes: 75, squadSize: 14 };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockRequireUser.mockResolvedValue({ user: { id: "u1" } });
  mockGenerate.mockResolvedValue({ text: JSON.stringify({ drills: [drill(1), drill(2)], coachReflection: "Q?" }) });
});

describe("generateSessionPlan constraints", () => {
  it("puts players, time, space and kit in the prompt as hard constraints", async () => {
    const res = await generateSessionPlan({ ...base, space: "half", kit: ["balls", "cones"] });
    expect(res.structured?.drills).toHaveLength(2);
    const prompt = mockGenerate.mock.calls[0][0].contents as string;
    expect(prompt).toContain("Players available: 14");
    expect(prompt).toContain("75 minutes");
    expect(prompt).toContain("about half a pitch");
    expect(prompt).toContain("balls, cones");
  });
  it("says nothing about space or kit when the coach didn't", async () => {
    await generateSessionPlan(base);
    const prompt = mockGenerate.mock.calls[0][0].contents as string;
    expect(prompt).not.toMatch(/Space:|Kit available/);
  });
  it("ignores a space or kit that isn't on the lists, and clamps the player count", async () => {
    // @ts-expect-error a hostile or stale client
    await generateSessionPlan({ ...base, squadSize: 5000, space: "the moon", kit: ["jetpack"] });
    const prompt = mockGenerate.mock.calls[0][0].contents as string;
    expect(prompt).toContain("Players available: 40");
    expect(prompt).not.toContain("moon");
    expect(prompt).not.toContain("jetpack");
  });
});
