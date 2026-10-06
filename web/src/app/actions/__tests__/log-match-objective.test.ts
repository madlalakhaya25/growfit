/**
 * The weekly focus ("What do we work on this week?") rides on logMatch. What is
 * tested: it is created only after the RPC accepted the result, for the
 * fixture's own team, from cleaned input; a third open objective is refused
 * without losing the result; and a database without migration 067 still saves
 * the result.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => mockRedirect(...a) }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["team-1"] }));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

import { logMatch } from "../fixtures";
import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";

const FIXTURE = "5b6f3c3e-8a51-4f0a-9d7e-0c1f7e2a9b11";

function setup(opts: { rpc?: FakeReply; open?: number; countError?: { code: string }; insertError?: { code: string }; closeMatches?: boolean } = {}) {
  const f = fakeSupabase((op: FakeOp): FakeReply => {
    if (op.table === "teams") return { data: op.one ? { academy_id: "acad-1" } : [{ id: "team-1" }] };
    if (op.table === "fixtures") return { data: { team_id: "team-1" } };
    if (op.table === "development_objectives") {
      if (op.action === "insert") return { error: opts.insertError ?? null };
      if (op.action === "update") return { data: opts.closeMatches === false ? [] : [{ id: "obj" }] };
      return { data: null, error: opts.countError ?? null, count: opts.open ?? 0 };
    }
    return { data: null };
  });
  const rpcReply = opts.rpc ?? { data: { success: true } };
  const rpc = jest.fn(async () => ({ data: rpcReply.data ?? null, error: rpcReply.error ?? null }));
  mockRequireUser.mockResolvedValue({ supabase: { ...f.client, rpc }, user: { id: "coach-1" } });
  return { calls: f.calls };
}

const payload = (objective?: unknown, follow_ups?: unknown) => ({
  fixture_id: FIXTURE, team_score: 1, opponent_score: 0, appearances: [], ratings: [],
  ...(objective === undefined ? {} : { objective }),
  ...(follow_ups === undefined ? {} : { follow_ups }),
});
const inserts = (calls: FakeOp[]) => calls.filter((c) => c.table === "development_objectives" && c.action === "insert");

beforeEach(() => jest.clearAllMocks());

it("opens an objective for the fixture's team from the cleaned problem", async () => {
  const { calls } = setup();
  await logMatch(payload({ phase: "in_possession", problem: "  Lost it playing out from the back. " }));
  expect(inserts(calls)).toHaveLength(1);
  expect(inserts(calls)[0].payload).toMatchObject({
    academy_id: "acad-1", subject_type: "team", subject_id: "team-1", source_type: "match",
    source_fixture_id: FIXTURE, phase: "in_possession", problem: "Lost it playing out from the back.",
    objective: "Work on: Lost it playing out from the back", created_by: "coach-1",
  });
  expect(mockRedirect).toHaveBeenCalledWith(`/dashboard/coach/fixtures/${FIXTURE}`);
});

it("creates no objective when none was sent", async () => {
  const { calls } = setup();
  await logMatch(payload());
  expect(calls.some((c) => c.table === "development_objectives")).toBe(false);
});

it("creates no objective when the RPC refuses the result", async () => {
  const { calls } = setup({ rpc: { data: { error: "Not your fixture." } } });
  expect(await logMatch(payload({ problem: "x" }))).toEqual({ error: "Not your fixture." });
  expect(calls.some((c) => c.table === "development_objectives")).toBe(false);
});

it("refuses a third open objective but says the result is saved", async () => {
  const { calls } = setup({ open: 2 });
  const res = await logMatch(payload({ problem: "x" }));
  expect(res).toEqual({ error: expect.stringContaining("The result is saved.") });
  expect(inserts(calls)).toHaveLength(0);
  expect(mockRedirect).not.toHaveBeenCalled();
});

it("reports an unusable problem without writing", async () => {
  const { calls } = setup();
  const res = await logMatch(payload({ problem: "x".repeat(201) }));
  expect(res).toEqual({ error: expect.stringContaining("The result is saved.") });
  expect(inserts(calls)).toHaveLength(0);
});

it("still saves the result before migration 067 creates the table", async () => {
  const { calls } = setup({ countError: { code: "PGRST205" } });
  const res = await logMatch(payload({ problem: "x" }));
  expect(res).toBeUndefined();
  expect(inserts(calls)).toHaveLength(0);
  expect(mockRedirect).toHaveBeenCalled();
});

describe("follow-up answers", () => {
  const OBJ = "44444444-4444-4444-8444-444444444444";
  const updates = (calls: FakeOp[]) => calls.filter((c) => c.table === "development_objectives" && c.action === "update");
  const order = (calls: FakeOp[]) => calls.filter((c) => c.table === "development_objectives" && c.action !== "select").map((c) => c.action);

  it("closes the answered objective with the verdict and this match", async () => {
    const { calls } = setup();
    await logMatch(payload(undefined, [{ objectiveId: OBJ, answer: "a_bit" }]));
    expect(updates(calls)).toHaveLength(1);
    expect(updates(calls)[0].payload).toMatchObject({ status: "closed", verdict: "partly", follow_up_fixture_id: FIXTURE });
    expect(mockRedirect).toHaveBeenCalled();
  });

  it("closes before it opens the new focus, so the place it frees can be used", async () => {
    const { calls } = setup();
    await logMatch(payload({ problem: "Same again" }, [{ objectiveId: OBJ, answer: "yes" }]));
    expect(order(calls)).toEqual(["update", "insert"]);
  });

  it("ignores answers that are malformed", async () => {
    const { calls } = setup();
    await logMatch(payload(undefined, [{ objectiveId: "nope", answer: "no" }, { objectiveId: OBJ, answer: "maybe" }]));
    expect(updates(calls)).toHaveLength(0);
  });

  it("writes no answers when the RPC refuses the result", async () => {
    const { calls } = setup({ rpc: { data: { error: "Not your fixture." } } });
    await logMatch(payload(undefined, [{ objectiveId: OBJ, answer: "no" }]));
    expect(updates(calls)).toHaveLength(0);
  });

  it("says the result is saved when an answer could not be saved", async () => {
    setup({ closeMatches: false });
    const res = await logMatch(payload(undefined, [{ objectiveId: OBJ, answer: "no" }]));
    expect(res).toEqual({ error: expect.stringContaining("The result is saved. 1 follow-up answer wasn't saved.") });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
