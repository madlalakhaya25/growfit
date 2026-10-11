jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["11111111-1111-4111-8111-111111111111"] }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => require("@/test-utils/genai-mock").genaiMock((...a: unknown[]) => mockGenerate(...a)));

import { applyMatchPoster, readMatchPoster } from "../match-poster";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const TEAM = "11111111-1111-4111-8111-111111111111";
const FIX = "22222222-2222-4222-8222-222222222222";

function setup(handler: (op: FakeOp) => { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const f = fakeSupabase(handler);
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}

// jsdom's File has no arrayBuffer().
File.prototype.arrayBuffer = async () => new ArrayBuffer(1);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
});

function posterForm(over: { type?: string; size?: number; team?: string } = {}) {
  const fd = new FormData();
  fd.set("team_id", over.team ?? TEAM);
  const file = new File(["x"], "p.png", { type: over.type ?? "image/png" });
  if (over.size) Object.defineProperty(file, "size", { value: over.size });
  fd.set("file", file);
  return fd;
}

describe("readMatchPoster", () => {
  const readHandler = (op: FakeOp) => {
    if (op.table === "teams") return { data: { id: TEAM, age_group: "U13", academy_id: "ac" } };
    if (op.table === "academies") return { data: { name: "Growfit Sports Academy" } };
    if (op.table === "fixtures") return { data: [{ id: FIX, opponent: "Rovers", fixture_date: "2026-10-18T07:00:00Z", status: "upcoming" }] };
    return { data: null };
  };

  it("refuses a team the coach does not coach, a wrong file type and a huge file, without calling the model", async () => {
    setup((op) => (op.table === "teams" ? { data: null } : { data: null }));
    expect((await readMatchPoster(posterForm())).error).toBe("Team not found.");
    setup(readHandler);
    expect((await readMatchPoster(posterForm({ type: "text/html" }))).error).toMatch(/photo/);
    expect((await readMatchPoster(posterForm({ size: 11 * 1024 * 1024 }))).error).toMatch(/10 MB/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("stops at the AI budget", async () => {
    setup(readHandler);
    mockBudget.mockResolvedValue("slow down");
    expect((await readMatchPoster(posterForm())).error).toBe("slow down");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("reads matches, orients the score and pairs the existing fixture", async () => {
    setup(readHandler);
    mockGenerate.mockResolvedValue({ text: JSON.stringify({ matches: [
      { home_team: "Rovers", away_team: "Growfit Sports Academy", home_score: 1, away_score: 4, date: "2026-10-18", time: "09:00" },
    ] }) });
    const res = await readMatchPoster(posterForm());
    expect(res.matches).toHaveLength(1);
    expect(res.matches![0]).toMatchObject({ usIsHome: false, homeScore: 1, awayScore: 4, fixtureId: FIX });
  });

  it("says so when nothing was found or the answer is unreadable", async () => {
    setup(readHandler);
    mockGenerate.mockResolvedValue({ text: JSON.stringify({ matches: [] }) });
    expect((await readMatchPoster(posterForm())).error).toMatch(/No matches/);
    mockGenerate.mockResolvedValue({ text: "nope" });
    expect((await readMatchPoster(posterForm())).error).toMatch(/Could not read/);
  });
});

describe("applyMatchPoster", () => {
  const PAST = { date: "2020-01-05", time: "09:00" };
  const base = { fixtureId: null, opponent: "Rovers", isHome: true, venue: null, teamScore: null, opponentScore: null, ...PAST };
  const ok = (extra: Partial<FakeOp["payload"]> = {}, ops: FakeOp[] = []) => (op: FakeOp) => {
    ops.push(op);
    if (op.table === "teams") return { data: { id: TEAM } };
    if (op.table === "fixtures" && op.action === "insert") return { data: { id: FIX } };
    if (op.table === "fixtures" && op.action === "select") return { data: { id: FIX, status: "upcoming", ...extra } };
    if (op.table === "rpc:log_match_result") return { data: { success: true } };
    return { data: null };
  };

  it("rejects bad input and teams that aren't the coach's", async () => {
    setup(ok());
    expect((await applyMatchPoster({ teamId: TEAM, rows: [{ ...base, date: "2026-02-31" }] })).error).toMatch(/Check each match/);
    setup((op) => (op.table === "teams" ? { data: null } : { data: null }));
    expect((await applyMatchPoster({ teamId: TEAM, rows: [base] })).error).toBe("Team not found.");
  });

  it("creates a fixture at South African kick-off time and logs a played score, our score first", async () => {
    const ops: FakeOp[] = [];
    setup(ok({}, ops));
    const res = await applyMatchPoster({ teamId: TEAM, rows: [{ ...base, teamScore: 3, opponentScore: 1 }] });
    expect(res.outcomes).toEqual([{ opponent: "Rovers", status: "created", resultLogged: true, note: null }]);
    expect(ops.find((o) => o.action === "insert")!.payload).toMatchObject({ team_id: TEAM, fixture_date: "2020-01-05T07:00:00.000Z" });
    expect(ops.find((o) => o.table === "rpc:log_match_result")!.payload).toMatchObject({
      p_fixture_id: FIX, p_team_score: 3, p_opponent_score: 1, p_appearances: [], p_ratings: [],
    });
  });

  it("does not log a score for a match that hasn't been played", async () => {
    const ops: FakeOp[] = [];
    setup(ok({}, ops));
    const res = await applyMatchPoster({ teamId: TEAM, rows: [{ ...base, date: "2099-01-05", teamScore: 3, opponentScore: 1 }] });
    expect(res.outcomes![0]).toMatchObject({ status: "created", resultLogged: false });
    expect(res.outcomes![0].note).toMatch(/hasn't been played/);
    expect(ops.some((o) => o.table === "rpc:log_match_result")).toBe(false);
  });

  it("updates an open fixture and leaves a completed or cancelled one alone", async () => {
    const ops: FakeOp[] = [];
    setup(ok({}, ops));
    const up = await applyMatchPoster({ teamId: TEAM, rows: [{ ...base, fixtureId: FIX, venue: "Field 2" }] });
    expect(up.outcomes![0]).toMatchObject({ status: "updated" });
    expect(ops.find((o) => o.action === "update")!.payload).toMatchObject({ venue: "Field 2", status: "upcoming" });

    for (const status of ["completed", "cancelled"]) {
      const o2: FakeOp[] = [];
      setup(ok({ status }, o2));
      const res = await applyMatchPoster({ teamId: TEAM, rows: [{ ...base, fixtureId: FIX, teamScore: 1, opponentScore: 0 }] });
      expect(res.outcomes![0].status).toBe("skipped");
      expect(o2.some((o) => o.action === "update" || o.table === "rpc:log_match_result")).toBe(false);
    }
  });

  it("keeps the saved match and says so when the result fails, and carries on with the next row", async () => {
    setup((op) => {
      if (op.table === "teams") return { data: { id: TEAM } };
      if (op.table === "fixtures" && op.action === "insert") return { data: { id: FIX } };
      if (op.table === "rpc:log_match_result") return { data: { error: "Fixture not found." } };
      return { data: null };
    });
    const res = await applyMatchPoster({ teamId: TEAM, rows: [{ ...base, teamScore: 1, opponentScore: 0 }, { ...base, opponent: "Stars" }] });
    expect(res.outcomes![0]).toMatchObject({ status: "created", resultLogged: false });
    expect(res.outcomes![0].note).toMatch(/result wasn't/);
    expect(res.outcomes![1].status).toBe("created");
  });
});
