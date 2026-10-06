/**
 * Tactics homework actions. What is tested: a coach only reaches plays and
 * homework on teams they coach; a player only reaches homework for their own
 * active teams and only ever writes their own response (player id from their
 * own row, never the client); the answer key is not sent before answering;
 * and a missing table (063 not run) is "not set up", not a crash. RLS itself
 * is proven against PostgreSQL (docs/MIGRATION_RUNBOOK.md, 063).
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
const mockCoached = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: (...a: unknown[]) => mockCoached(...a) }));
const mockSharedPlay = jest.fn();
jest.mock("@/app/actions/tactic-plays", () => ({ getSharedPlay: (...a: unknown[]) => mockSharedPlay(...a) }));
jest.mock("@/lib/time", () => ({ ...jest.requireActual("@/lib/time"), todayIso: () => "2026-10-04" }));

import { deleteHomework, getMyHomework, listCoachHomework, listMyHomework, sendHomework, submitHomework } from "../homework";
import { recordingSupabase } from "@/test-utils/recording-supabase";
import type { FakeOp, FakeReply } from "@/test-utils/fake-supabase";

const MINE = "team-mine";
const QUESTIONS = [
  { prompt: "Where does the 8 run?", options: ["Wide", "Into the box"], correct: 1, explanation: "To arrive late in the box." },
  { prompt: "Who presses first?", options: ["The 9", "The 6", "The keeper"], correct: 0 },
];
const MISSING = { code: "PGRST205", message: "Could not find the table" };

function setup(handler: (op: FakeOp) => FakeReply) {
  const d = recordingSupabase(handler);
  mockRequireUser.mockResolvedValue({ supabase: d.client, user: { id: "user-1" } });
  return d;
}
const ops = (d: ReturnType<typeof setup>, table: string, action: string) =>
  d.calls.filter((c) => c.table === table && c.action === action);

beforeEach(() => {
  jest.clearAllMocks();
  mockCoached.mockResolvedValue([MINE]);
});

const sendInput = { playId: "play-1", title: "Overlap", dueDate: "2026-10-07", questions: QUESTIONS };

describe("sendHomework", () => {
  it("refuses a play on a team the caller doesn't coach, and writes nothing", async () => {
    const d = setup(() => ({ data: null }));
    expect(await sendHomework(sendInput)).toEqual({ error: "Play not found, or you don't coach its team." });
    expect(d.filtersOn("tactic_plays", "in")).toEqual([["team_id", [MINE]]]);
    expect(d.calls.some((c) => c.action !== "select")).toBe(false);
  });

  it("checks the quiz before touching the database", async () => {
    const d = setup(() => ({ data: null }));
    expect((await sendHomework({ ...sendInput, questions: [] })).error).toMatch(/at least one/);
    expect((await sendHomework({ ...sendInput, dueDate: "2026-10-01" })).error).toMatch(/passed/);
    expect((await sendHomework({ ...sendInput, title: " " })).error).toMatch(/title/);
    expect(d.calls).toHaveLength(0);
  });

  it("creates the homework on the play's own team and shares the play", async () => {
    const d = setup((op) => {
      if (op.table === "tactic_plays" && op.action === "select") return { data: { id: "play-1", team_id: MINE, academy_id: "ac" } };
      if (op.table === "homework_assignments") return { data: { id: "hw-1" } };
      return { data: null };
    });
    expect(await sendHomework(sendInput)).toEqual({ id: "hw-1" });
    expect(ops(d, "homework_assignments", "insert")[0].payload).toEqual({
      academy_id: "ac", team_id: MINE, play_id: "play-1", title: "Overlap",
      questions: QUESTIONS, due_date: "2026-10-07", created_by: "user-1",
    });
    expect(ops(d, "tactic_plays", "update")[0].payload).toEqual({ shared: true });
    expect(d.filtersOn("tactic_plays", "eq")).toContainEqual(["team_id", MINE]);
  });

  it("says the database needs 063 when the table is missing, and shares nothing", async () => {
    const d = setup((op) => {
      if (op.table === "tactic_plays") return { data: { id: "play-1", team_id: MINE, academy_id: "ac" } };
      return { error: MISSING };
    });
    expect((await sendHomework(sendInput)).error).toMatch(/063/);
    expect(ops(d, "tactic_plays", "update")).toHaveLength(0);
  });
});

describe("deleteHomework", () => {
  it("only deletes homework on a coached team", async () => {
    const d = setup(() => ({ data: [] }));
    expect((await deleteHomework("hw-1")).error).toMatch(/don't coach its team/);
    expect(d.filtersOn("homework_assignments", "in")).toEqual([["team_id", [MINE]]]);
  });

  it("deletes one it finds", async () => {
    setup(() => ({ data: [{ id: "hw-1" }] }));
    expect(await deleteHomework("hw-1")).toEqual({ success: true });
  });
});

describe("listCoachHomework", () => {
  it("is not set up before 063, not an error", async () => {
    setup(() => ({ error: MISSING }));
    expect(await listCoachHomework()).toEqual({ available: false, items: [] });
  });

  it("only asks for the caller's teams, and summarises who has done it", async () => {
    const d = setup((op) => {
      if (op.table === "homework_assignments") {
        return { data: [{ id: "hw-1", team_id: MINE, play_id: "p", title: "Overlap", questions: QUESTIONS, due_date: "2026-10-07", teams: { name: "U13" } }] };
      }
      if (op.table === "team_members") {
        return { data: [
          { team_id: MINE, players: { id: "a", full_name: "Ayanda" } },
          { team_id: MINE, players: [{ id: "b", full_name: "Bheki" }] },
        ] };
      }
      if (op.table === "homework_responses") {
        return { data: [{ assignment_id: "hw-1", player_id: "a", answers: [0, 1], score: 0, total: 2, completed_at: "t" }] };
      }
      return { data: null };
    });
    const { items } = await listCoachHomework();
    expect(d.filtersOn("homework_assignments", "in")).toEqual([["team_id", [MINE]]]);
    expect(items[0].teamName).toBe("U13");
    expect(items[0].summary.players.map((p) => [p.name, p.done, p.struggled])).toEqual([["Ayanda", true, true], ["Bheki", false, false]]);
    expect(items[0].summary.missedPerQuestion).toEqual([1, 1]);
  });
});

function playerDb(over: { player?: unknown; assignment?: unknown; response?: unknown; insertError?: { code?: string } | null; tokenReply?: FakeReply } = {}) {
  return setup((op) => {
    if (op.table === "rpc:shared_play_token") return over.tokenReply ?? { data: "tok" };
    if (op.table === "players") return { data: "player" in over ? over.player : { id: "player-1" } };
    if (op.table === "team_members") return { data: [{ team_id: MINE }] };
    if (op.table === "homework_assignments") {
      return { data: "assignment" in over ? over.assignment : { id: "hw-1", team_id: MINE, play_id: "play-1", title: "Overlap", questions: QUESTIONS, due_date: "2026-10-07" } };
    }
    if (op.table === "homework_responses") {
      if (op.action === "insert") return { error: over.insertError ?? null };
      return { data: "response" in over ? over.response : null };
    }
    if (op.table === "tactic_plays") return { data: { share_token: "tok" } };
    return { data: null };
  });
}

describe("submitHomework", () => {
  it("refuses someone who isn't a player", async () => {
    const d = playerDb({ player: null });
    expect((await submitHomework("hw-1", [1, 0])).error).toMatch(/isn't linked/);
    expect(ops(d, "homework_responses", "insert")).toHaveLength(0);
  });

  it("refuses homework that isn't for the player's teams", async () => {
    const d = playerDb({ assignment: null });
    expect((await submitHomework("hw-1", [1, 0])).error).toMatch(/isn't for your team/);
    expect(d.filtersOn("homework_assignments", "in")).toEqual([["team_id", [MINE]]]);
    expect(ops(d, "homework_responses", "insert")).toHaveLength(0);
  });

  it("refuses incomplete answers", async () => {
    const d = playerDb();
    expect((await submitHomework("hw-1", [1])).error).toMatch(/every question/);
    expect(ops(d, "homework_responses", "insert")).toHaveLength(0);
  });

  it("saves the player's own answers (never a client score) and replies kindly", async () => {
    const d = playerDb();
    const res = await submitHomework("hw-1", [1, 2]);
    expect(ops(d, "homework_responses", "insert")[0].payload).toEqual({ assignment_id: "hw-1", player_id: "player-1", answers: [1, 2] });
    expect(res.score).toBe(1);
    expect(res.total).toBe(2);
    expect(res.message).toMatch(/^1 of 2, nice/);
    expect(res.feedback?.[0]).toEqual({ chosen: 1, correct: 1, right: true, explanation: "To arrive late in the box." });
  });

  it("says so kindly when it was already done", async () => {
    playerDb({ insertError: { code: "23505" } });
    expect((await submitHomework("hw-1", [1, 0])).error).toMatch(/already done/);
  });
});

describe("getMyHomework", () => {
  beforeEach(() => mockSharedPlay.mockResolvedValue({ play: { name: "Overlap", notes: null, data: { tokens: [] } } }));

  it("sends the questions without the answer key before answering", async () => {
    playerDb();
    const { homework } = await getMyHomework("hw-1");
    expect(homework?.result).toBeNull();
    expect(JSON.stringify(homework?.questions)).not.toMatch(/correct|explanation|arrive late/);
    expect(homework?.play).toEqual({ name: "Overlap", notes: null, data: { tokens: [] } });
    expect(mockSharedPlay).toHaveBeenCalledWith("tok");
  });

  it("gets the play's token from the function, never by reading the play row", async () => {
    const d = playerDb();
    await getMyHomework("hw-1");
    expect(d.calls.some((c) => c.table === "rpc:shared_play_token" && c.payload?.p_play_id === "play-1")).toBe(true);
    expect(d.calls.some((c) => c.table === "tactic_plays")).toBe(false);
  });

  it("shows no play, and reads no row, when the function says it is not shared with this player", async () => {
    const d = playerDb({ tokenReply: { data: null } });
    const { homework } = await getMyHomework("hw-1");
    expect(homework?.play).toBeNull();
    expect(mockSharedPlay).not.toHaveBeenCalled();
    expect(d.calls.some((c) => c.table === "tactic_plays")).toBe(false);
  });

  it("falls back to reading the row only while migration 070 has not run", async () => {
    const d = playerDb({ tokenReply: { error: { code: "PGRST202", message: "no function" } } });
    await getMyHomework("hw-1");
    expect(d.calls.some((c) => c.table === "tactic_plays")).toBe(true);
    expect(mockSharedPlay).toHaveBeenCalledWith("tok");
  });

  it("shows the result and the why once answered", async () => {
    playerDb({ response: { answers: [0, 0], score: 1, total: 2 } });
    const { homework } = await getMyHomework("hw-1");
    expect(homework?.result?.message).toMatch(/1 of 2/);
    expect(homework?.result?.feedback[0]).toMatchObject({ right: false, correct: 1, explanation: "To arrive late in the box." });
  });

  it("refuses homework for another team", async () => {
    playerDb({ assignment: null });
    expect((await getMyHomework("hw-1")).error).toMatch(/isn't for your team/);
  });
});

describe("listMyHomework", () => {
  it("is not set up before 063", async () => {
    setup((op) => {
      if (op.table === "players") return { data: { id: "player-1" } };
      if (op.table === "team_members") return { data: [{ team_id: MINE }] };
      return { error: MISSING };
    });
    expect(await listMyHomework()).toEqual({ available: false, items: [] });
  });

  it("marks what is done with the score", async () => {
    setup((op) => {
      if (op.table === "players") return { data: { id: "player-1" } };
      if (op.table === "team_members") return { data: [{ team_id: MINE }] };
      if (op.table === "homework_assignments") return { data: [{ id: "hw-1", team_id: MINE, title: "Overlap", due_date: "2026-10-07", teams: [{ name: "U13" }] }, { id: "hw-2", team_id: MINE, title: "Press", due_date: "2026-10-08", teams: null }] };
      if (op.table === "homework_responses") return { data: [{ assignment_id: "hw-1", score: 2, total: 2 }] };
      return { data: null };
    });
    const { items } = await listMyHomework();
    expect(items.map((i) => [i.id, i.teamName, i.done, i.score])).toEqual([["hw-1", "U13", true, 2], ["hw-2", "", false, null]]);
  });
});
