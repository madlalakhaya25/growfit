const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
const mockCoached = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: (...a: unknown[]) => mockCoached(...a) }));
const mockRecent = jest.fn();
jest.mock("@/lib/session-memory-data", () => ({ loadRecentSessions: (...a: unknown[]) => mockRecent(...a) }));
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: async () => null, aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING", NUMBER: "NUMBER" },
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { generateSessionPlan } from "../session-generator";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const drill = (n: number) => ({
  name: `Drill ${n}`, durationMinutes: 10, ltpdFocus: "x", fourCorner: "Technical", setup: "s", instructions: "i", coachingPoints: "c",
});
const base = { ageGroup: "U13", sessionType: "general", focusArea: "Pressing", durationMinutes: 75, squadSize: 14 };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  const sb = fakeSupabase((op) => (op.table === "training_sessions" ? { data: { session_date: "2026-09-30T15:00:00Z" } } : { data: null }));
  mockRequireUser.mockResolvedValue({ supabase: sb.client, user: { id: "u1" } });
  mockCoached.mockResolvedValue(["t1"]);
  mockRecent.mockResolvedValue([]);
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

const past = (title: string) => ({
  title, sessionType: "technical", date: "2026-09-23T15:00:00Z", notes: null,
  drills: [{ title: "Rondo", description: null }], attended: 12, assessed: 14,
});

describe("generateSessionPlan memory", () => {
  it("builds on the team's last sessions and says how many", async () => {
    mockRecent.mockResolvedValue([past("Wed"), past("Fri")]);
    const res = await generateSessionPlan({ ...base, teamId: "t1" });
    expect(res.builtOn).toBe(2);
    const prompt = mockGenerate.mock.calls[0][0].contents as string;
    expect(prompt).toContain("WHAT THE TEAM HAS BEEN DOING");
    expect(prompt).toContain("12 of 14 marked players came");
    expect(prompt).toContain("do not repeat a drill by name");
  });
  it("plans for an existing session from what came before it, and not itself", async () => {
    await generateSessionPlan({ ...base, teamId: "t1", sessionId: "s9" });
    const [, teamId, before, exclude] = mockRecent.mock.calls[0];
    expect(teamId).toBe("t1");
    expect((before as Date).toISOString()).toBe("2026-09-30T15:00:00.000Z");
    expect(exclude).toBe("s9");
  });
  it("adds no memory block when there is no history, or no team", async () => {
    await generateSessionPlan({ ...base, teamId: "t1" });
    expect(mockGenerate.mock.calls[0][0].contents).not.toContain("WHAT THE TEAM HAS BEEN DOING");
    mockRecent.mockClear();
    await generateSessionPlan(base);
    expect(mockRecent).not.toHaveBeenCalled();
  });
  it("refuses a team the caller doesn't coach, before reading anything or calling the model", async () => {
    mockCoached.mockResolvedValue(["other"]);
    expect(await generateSessionPlan({ ...base, teamId: "t1" })).toEqual({ error: "You don't coach this team." });
    expect(mockRecent).not.toHaveBeenCalled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
