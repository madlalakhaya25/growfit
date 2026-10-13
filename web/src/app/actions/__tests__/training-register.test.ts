/**
 * Saving a training register in one batch. What is tested: the batch is one
 * upsert with the last mark per player, unknown statuses are dropped, a
 * session the caller doesn't coach is refused, and an empty batch writes
 * nothing.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["team-1"] }));

import { saveTrainingRegister } from "../attendance";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import type { AttendanceStatus } from "@/lib/attendance";

function db(opts: { coached?: boolean } = {}) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "training_sessions") return { data: opts.coached === false ? null : { id: "s1" } };
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "coach-1" } });
  return f;
}
const upserts = (f: ReturnType<typeof db>) => f.calls.filter((c) => c.table === "training_attendance" && c.action === "upsert");

beforeEach(() => jest.clearAllMocks());

it("writes the whole batch in one upsert, keeping each player's last mark", async () => {
  const f = db();
  const res = await saveTrainingRegister("s1", [
    { playerId: "p1", status: "present" },
    { playerId: "p2", status: "absent" },
    { playerId: "p1", status: "late" },
  ]);
  expect(res).toEqual({ success: true });
  expect(upserts(f)).toHaveLength(1);
  const rows = upserts(f)[0].payload as unknown as { player_id: string; status: string; marked_by: string }[];
  expect(rows.map((r) => [r.player_id, r.status])).toEqual([["p1", "late"], ["p2", "absent"]]);
  expect(rows.every((r) => r.marked_by === "coach-1")).toBe(true);
});

it("drops marks with a status the register doesn't know", async () => {
  const f = db();
  await saveTrainingRegister("s1", [
    { playerId: "p1", status: "attending" as AttendanceStatus },
    { playerId: "p2", status: "excused" },
  ]);
  const rows = upserts(f)[0].payload as unknown as { player_id: string }[];
  expect(rows.map((r) => r.player_id)).toEqual(["p2"]);
});

it("refuses a session the caller doesn't coach", async () => {
  const f = db({ coached: false });
  const res = await saveTrainingRegister("s1", [{ playerId: "p1", status: "present" }]);
  expect(res.error).toBeDefined();
  expect(upserts(f)).toHaveLength(0);
});

it("writes nothing for an empty batch", async () => {
  const f = db();
  expect(await saveTrainingRegister("s1", [])).toEqual({ success: true });
  expect(f.calls).toHaveLength(0);
});
