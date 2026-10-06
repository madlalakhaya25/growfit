/**
 * What a player sees as "plays shared with my team". What is tested: it comes
 * from the migration 070 function (which never returns the play's `data`, so
 * never a teammate's private notes), the table is read directly only while that
 * function is missing, and any other error is shown, not swallowed.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: jest.fn() }));

import { listSharedPlaysForMe } from "../tactic-plays";
import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";

function setup(handler: (op: FakeOp) => FakeReply) {
  const f = fakeSupabase(handler);
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}

const row = { id: "p1", name: "Overlap", notes: null, share_token: "tok", concept_ids: null, voice_url: null, updated_at: "2026-10-01", team_name: "U13" };

it("lists plays from the function and never touches the plays table", async () => {
  const f = setup((op) => (op.table === "rpc:list_my_shared_plays" ? { data: [row] } : { data: null }));
  const res = await listSharedPlaysForMe();
  expect(res.plays).toEqual([{ id: "p1", name: "Overlap", notes: null, share_token: "tok", concept_ids: [], voice_url: null, updated_at: "2026-10-01", team_name: "U13" }]);
  expect(f.calls.map((c) => c.table)).toEqual(["rpc:list_my_shared_plays"]);
});

it("falls back to the direct read only while migration 070 has not run", async () => {
  const f = setup((op) => {
    if (op.table === "rpc:list_my_shared_plays") return { error: { code: "42883", message: "no function" } };
    if (op.table === "players") return { data: { id: "pl1" } };
    if (op.table === "team_members") return { data: [{ team_id: "t1" }] };
    if (op.table === "tactic_plays") return { data: [{ ...row, teams: { name: "U13" } }] };
    return { data: null };
  });
  const res = await listSharedPlaysForMe();
  expect(res.plays?.[0]).toMatchObject({ id: "p1", team_name: "U13" });
  expect(f.calls.some((c) => c.table === "tactic_plays")).toBe(true);
});

it("shows any other function error instead of quietly reading the table", async () => {
  const f = setup((op) => (op.table === "rpc:list_my_shared_plays" ? { error: { code: "42501", message: "denied" } } : { data: null }));
  const res = await listSharedPlaysForMe();
  expect(res.error).toBeTruthy();
  expect(res.plays).toBeUndefined();
  expect(f.calls.some((c) => c.table === "tactic_plays")).toBe(false);
});
