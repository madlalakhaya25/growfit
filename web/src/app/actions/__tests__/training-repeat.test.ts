/**
 * Repeating a new session weekly. What is tested: every repeat is written in
 * one insert with the time of day read as South African time, days the team
 * already trains are skipped, drills are copied to every session, and a
 * session with no repeat is written alone.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["22222222-2222-4222-8222-222222222222"] }));

import { createTrainingSessionWithDrills } from "../training";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const TEAM = "22222222-2222-4222-8222-222222222222";

function db(existing: string[] = []) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "teams") return { data: [{ id: TEAM }] };
    if (op.table === "training_sessions" && op.action === "select") return { data: existing.map((session_date) => ({ session_date })) };
    if (op.table === "training_sessions" && op.action === "insert") {
      const rows = op.payload as unknown as { session_date: string }[];
      // Returned out of order on purpose: the action must pick the earliest.
      return { data: rows.map((r, i) => ({ id: `s${i}`, session_date: r.session_date })).reverse() };
    }
    return { data: [] };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}

const base = {
  team_id: TEAM, title: "Training", session_date: "2026-10-14T17:00", session_type: "general",
  drills: [{ title: "Rondo" }],
};
const inserted = (f: ReturnType<typeof db>, table: string) =>
  f.calls.filter((c) => c.table === table && c.action === "insert").flatMap((c) => c.payload as unknown as Record<string, unknown>[]);

beforeEach(() => jest.clearAllMocks());

it("creates every Wednesday and Friday until the end date, at 17:00 South African time", async () => {
  const f = db();
  const res = await createTrainingSessionWithDrills({ ...base, repeat: { weekdays: [3, 5], until: "2026-10-23" } });
  expect(res).toEqual({ id: "s0", created: 4 });
  expect(inserted(f, "training_sessions").map((r) => r.session_date)).toEqual([
    "2026-10-14T15:00:00.000Z", "2026-10-16T15:00:00.000Z", "2026-10-21T15:00:00.000Z", "2026-10-23T15:00:00.000Z",
  ]);
  expect(inserted(f, "training_drills")).toHaveLength(4);
});

it("skips a repeat on a day the team already has a session", async () => {
  const f = db(["2026-10-16T13:30:00+00:00"]);
  await createTrainingSessionWithDrills({ ...base, repeat: { weekdays: [3, 5], until: "2026-10-23" } });
  expect(inserted(f, "training_sessions").map((r) => r.session_date)).toEqual([
    "2026-10-14T15:00:00.000Z", "2026-10-21T15:00:00.000Z", "2026-10-23T15:00:00.000Z",
  ]);
});

it("writes a single session when there is no repeat, without looking for clashes", async () => {
  const f = db();
  expect(await createTrainingSessionWithDrills(base)).toEqual({ id: "s0", created: 1 });
  expect(inserted(f, "training_sessions")).toHaveLength(1);
  expect(f.calls.some((c) => c.table === "training_sessions" && c.action === "select")).toBe(false);
});
