/**
 * Linking a session or objective to curriculum items. What is tested: only
 * staff may link, a coach only their own team's work, items from another age
 * group or retired items are dropped, the old links are replaced, and a
 * missing table or a bad request writes nothing.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { setCurriculumLinks } from "../curriculum-links";

const S = "11111111-1111-4111-8111-111111111111";
const I13 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const I15 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IOLD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const item = (id: string, age: string, over: Record<string, unknown> = {}) => ({
  id, age_group: age, category: "technical", title: id, description: null, sort_order: 0, active: true, ...over,
});

function setup(over: { profile?: unknown; teamId?: string; tableError?: boolean; session?: unknown } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.table === "development_objectives") return { data: { subject_id: over.teamId ?? "t1", teams: { age_group: "U13" } } };
    if (op.table === "training_sessions") return { data: "session" in over ? over.session : { team_id: over.teamId ?? "t1", teams: { age_group: "U13" } } };
    if (op.table === "curriculum_items") {
      return over.tableError ? { error: { code: "PGRST205" } } : { data: [item(I13, "U13"), item(I15, "U15"), item(IOLD, "U13", { active: false })] };
    }
    return {};
  });
  mockRequireStaff.mockResolvedValue({ supabase: f.client, user: { id: "u1" }, profile: "profile" in over ? over.profile : { role: "coach" } });
  return ops;
}
const writes = (ops: FakeOp[]) => ops.filter((o) => o.table === "curriculum_links");

beforeEach(() => jest.clearAllMocks());

it("replaces the links with the team's own active items only", async () => {
  const ops = setup();
  expect(await setCurriculumLinks("session", S, [I13, I15, IOLD])).toEqual({ success: true, saved: 1 });
  const w = writes(ops);
  expect(w.map((o) => o.action)).toEqual(["delete", "insert"]);
  expect(w[1].payload).toEqual([{ item_id: I13, link_type: "session", link_id: S }]);
});

it("clears the links when nothing is chosen, without inserting", async () => {
  const ops = setup();
  expect(await setCurriculumLinks("session", S, [])).toEqual({ success: true, saved: 0 });
  expect(writes(ops).map((o) => o.action)).toEqual(["delete"]);
});

it("refuses anyone who is not staff, and a coach on another team's session", async () => {
  const none = setup({ profile: null });
  expect(await setCurriculumLinks("session", S, [I13])).toEqual({ error: "Unauthorized" });
  expect(writes(none)).toEqual([]);
  const other = setup({ teamId: "t2" });
  expect(await setCurriculumLinks("session", S, [I13])).toEqual({ error: "Not found." });
  expect(writes(other)).toEqual([]);
});

it("lets an admin link any team's session", async () => {
  setup({ profile: { role: "admin" }, teamId: "t2" });
  expect(await setCurriculumLinks("session", S, [I13])).toEqual({ success: true, saved: 1 });
});

it("writes nothing for a bad request, a missing session or a missing table", async () => {
  const bad = setup();
  expect(await setCurriculumLinks("drill", S, [I13])).toEqual({ error: expect.stringContaining("up to 20") });
  expect(writes(bad)).toEqual([]);
  const gone = setup({ session: null });
  expect(await setCurriculumLinks("session", S, [I13])).toEqual({ error: "Not found." });
  expect(writes(gone)).toEqual([]);
  const noTable = setup({ tableError: true });
  expect(await setCurriculumLinks("session", S, [I13])).toEqual({ error: "Curriculum is not set up yet." });
  expect(writes(noTable)).toEqual([]);
});

it("links an objective of the coach's own team, and refuses another team's", async () => {
  const ops = setup();
  expect(await setCurriculumLinks("objective", S, [I13])).toEqual({ success: true, saved: 1 });
  expect(writes(ops)[1].payload).toEqual([{ item_id: I13, link_type: "objective", link_id: S }]);
  const other = setup({ teamId: "t2" });
  expect(await setCurriculumLinks("objective", S, [I13])).toEqual({ error: "Not found." });
  expect(writes(other)).toEqual([]);
});
