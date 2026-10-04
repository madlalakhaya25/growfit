/**
 * Plays are readable academy-wide at the database and their write policies only
 * check "is a coach" (migration 015), so these actions are the boundary. What is
 * tested: every action that starts from a play id only reaches a play on a team
 * the caller coaches, and a refusal touches nothing.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
const mockCoached = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: (...a: unknown[]) => mockCoached(...a) }));

import { deletePlay, deletePlayVoiceNote, listPlays, loadPlay, savePlay, setPlayFolder, sharePlayToSquad } from "../tactic-plays";
import { recordingSupabase } from "@/test-utils/recording-supabase";
import type { FakeOp, FakeReply } from "@/test-utils/fake-supabase";

const MINE = "team-mine";

function setup(handler: (op: FakeOp) => FakeReply) {
  const d = recordingSupabase(handler);
  mockRequireUser.mockResolvedValue({ supabase: d.client, user: { id: "coach-1" } });
  return d;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCoached.mockResolvedValue([MINE]);
});

describe("actions that start from a play id", () => {
  it("loadPlay only looks at plays on the caller's coached teams, and refuses anything else", async () => {
    const d = setup(() => ({ data: null }));
    expect(await loadPlay("play-1")).toEqual({ error: "Play not found, or you don't coach its team." });
    expect(d.filtersOn("tactic_plays", "in")).toEqual([["team_id", [MINE]]]);
  });

  it("loadPlay returns the play when it is on a coached team", async () => {
    setup(() => ({ data: { name: "Overlap", notes: "n", data: { tokens: [] } } }));
    expect(await loadPlay("play-1")).toEqual({ data: { tokens: [] }, name: "Overlap", notes: "n" });
  });

  it("deletePlay deletes nothing when the play isn't on a coached team", async () => {
    const d = setup(() => ({ data: null }));
    expect((await deletePlay("play-1")).error).toMatch(/don't coach its team/);
    expect(d.calls.some((c) => c.action === "delete")).toBe(false);
  });

  it("deletePlay deletes a play on a coached team", async () => {
    const d = setup(() => ({ data: { id: "play-1" } }));
    expect(await deletePlay("play-1")).toEqual({ success: true });
    expect(d.calls.some((c) => c.table === "tactic_plays" && c.action === "delete")).toBe(true);
  });

  it("deletePlayVoiceNote changes nothing on another team's play", async () => {
    const d = setup(() => ({ data: null }));
    expect((await deletePlayVoiceNote("play-1")).error).toMatch(/don't coach its team/);
    expect(d.calls.some((c) => c.action === "update")).toBe(false);
  });
});

describe("team-scoped actions", () => {
  const coachedTeam = (op: FakeOp): FakeReply | null =>
    op.table === "teams" ? { data: { id: MINE, academy_id: "ac-1" } } : null;

  it("listPlays refuses a team the caller doesn't coach, before reading any play", async () => {
    const d = setup((op) => (op.table === "teams" ? { data: null } : { data: [] }));
    expect(await listPlays("team-other")).toEqual({ error: "You don't coach this team." });
    expect(d.calls.some((c) => c.table === "tactic_plays")).toBe(false);
  });

  it("savePlay only updates a play on the coached team, and says so when none matched", async () => {
    const d = setup((op) => coachedTeam(op) ?? (op.action === "update" ? { data: [] } : { data: null }));
    const res = await savePlay({ playId: "play-other", teamId: MINE, name: "Press", data: {} });
    expect(res).toEqual({ error: "Play not found, or you don't coach its team." });
    expect(d.filtersOn("tactic_plays", "eq")).toEqual(expect.arrayContaining([["id", "play-other"], ["team_id", MINE]]));
  });

  it("sharePlayToSquad only marks a play on the coached team as shared", async () => {
    const d = setup((op) => coachedTeam(op) ?? { data: { share_token: "tok" } });
    await sharePlayToSquad({ teamId: MINE, playId: "play-1", playName: "Press" });
    expect(d.filtersOn("tactic_plays", "eq")).toEqual(expect.arrayContaining([["id", "play-1"], ["team_id", MINE]]));
  });
});

describe("play folders", () => {
  it("setPlayFolder changes nothing on another team's play", async () => {
    const d = setup(() => ({ data: null }));
    expect((await setPlayFolder("play-1", "Build-up")).error).toMatch(/don't coach its team/);
    expect(d.calls.some((c) => c.action === "update")).toBe(false);
  });

  it("setPlayFolder stores the tidied name on a play the caller coaches, scoped to its team", async () => {
    const d = setup((op) => (op.action === "update" ? { data: null } : { data: { id: "play-1", team_id: MINE } }));
    expect(await setPlayFolder("play-1", "  Set   pieces ")).toEqual({ folder: "Set pieces" });
    expect(d.calls.find((c) => c.action === "update")?.payload).toEqual({ folder: "Set pieces" });
    expect(d.filtersOn("tactic_plays", "eq")).toEqual(expect.arrayContaining([["id", "play-1"], ["team_id", MINE]]));
  });

  it("setPlayFolder with an empty name takes the play out of its folder", async () => {
    const d = setup((op) => (op.action === "update" ? { data: null } : { data: { id: "play-1", team_id: MINE } }));
    expect(await setPlayFolder("play-1", "   ")).toEqual({ folder: null });
    expect(d.calls.find((c) => c.action === "update")?.payload).toEqual({ folder: null });
  });

  it("setPlayFolder names the database update when the column is missing", async () => {
    setup((op) => (op.action === "update" ? { error: { code: "42703" } } : { data: { id: "play-1", team_id: MINE } }));
    expect((await setPlayFolder("play-1", "Press")).error).toMatch(/061/);
  });

  it("listPlays still lists plays, unfiled, before the folder column exists", async () => {
    let selects = 0;
    setup((op) => {
      if (op.table === "teams") return { data: { id: MINE, academy_id: "ac-1" } };
      selects += 1;
      return selects === 1 ? { error: { code: "42703" } } : { data: [{ id: "p1", name: "Press" }] };
    });
    expect(await listPlays(MINE)).toEqual({ plays: [{ id: "p1", name: "Press" }] });
    expect(selects).toBe(2);
  });
});
