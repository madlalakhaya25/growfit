/**
 * A session planned from a team objective is linked to it. What is tested: a
 * valid objective id links the new session, a malformed one is ignored, and no
 * link is written when the session itself failed to save.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["22222222-2222-4222-8222-222222222222"] }));

import { createTrainingSessionWithDrills } from "../training";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const TEAM = "22222222-2222-4222-8222-222222222222";
const SESSION = "11111111-1111-4111-8111-111111111111";
const OBJECTIVE = "33333333-3333-4333-8333-333333333333";

function db(opts: { sessionFails?: boolean } = {}) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "teams") return { data: [{ id: TEAM }] };
    if (op.table === "training_sessions") return opts.sessionFails ? { data: null, error: { message: "nope" } } : { data: { id: SESSION } };
    return { data: [] };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}

const params = (objective_id?: string) => ({
  team_id: TEAM, title: "Playing out", session_date: "2026-10-09T15:00:00Z",
  session_type: "technical", drills: [], ...(objective_id === undefined ? {} : { objective_id }),
});
const links = (f: ReturnType<typeof db>) =>
  f.calls.filter((c) => c.table === "development_objective_links" && c.action === "upsert");

beforeEach(() => jest.clearAllMocks());

it("links the saved session to the objective it was planned for", async () => {
  const f = db();
  expect(await createTrainingSessionWithDrills(params(OBJECTIVE))).toEqual({ id: SESSION });
  expect(links(f)).toHaveLength(1);
  expect(links(f)[0].payload).toEqual({ objective_id: OBJECTIVE, link_type: "session", link_id: SESSION });
});

it("writes no link when no objective was sent", async () => {
  const f = db();
  await createTrainingSessionWithDrills(params());
  expect(links(f)).toHaveLength(0);
});

it("ignores an objective id that is not a uuid", async () => {
  const f = db();
  expect(await createTrainingSessionWithDrills(params("not-a-uuid"))).toEqual({ id: SESSION });
  expect(links(f)).toHaveLength(0);
});

it("writes no link when the session did not save", async () => {
  const f = db({ sessionFails: true });
  const res = await createTrainingSessionWithDrills(params(OBJECTIVE));
  expect(res.error).toBeDefined();
  expect(links(f)).toHaveLength(0);
});
