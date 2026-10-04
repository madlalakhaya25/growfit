/**
 * Phase-of-play ratings ride alongside log_match_result. What is tested: they
 * are cleaned before storing, written only after the RPC accepted the result,
 * and a database without migration 061 still saves the result.
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

function setup(rpcReply: FakeReply, handler: (op: FakeOp) => FakeReply = () => ({ data: null })) {
  const f = fakeSupabase((op) => (op.table === "teams" ? { data: [{ id: "team-1" }] } : handler(op)));
  const rpc = jest.fn(async () => ({ data: rpcReply.data ?? null, error: rpcReply.error ?? null }));
  mockRequireUser.mockResolvedValue({ supabase: { ...f.client, rpc }, user: { id: "coach-1" } });
  return { calls: f.calls, rpc };
}

const payload = (phase_ratings?: Record<string, number>) => ({
  fixture_id: FIXTURE,
  team_score: 2,
  opponent_score: 1,
  appearances: [],
  ratings: [],
  ...(phase_ratings ? { phase_ratings } : {}),
});

beforeEach(() => jest.clearAllMocks());

it("stores only the known phases rated 1 to 5, against this fixture's result", async () => {
  const { calls } = setup({ data: { success: true } });
  await logMatch(payload({ in_possession: 4, set_pieces: 9, shooting: 3 }));
  const update = calls.find((c) => c.table === "match_results" && c.action === "update");
  expect(update?.payload).toEqual({ phase_ratings: { in_possession: 4 } });
  expect(mockRedirect).toHaveBeenCalledWith(`/dashboard/coach/fixtures/${FIXTURE}`);
});

it("writes no phase ratings when the RPC refuses the result", async () => {
  const { calls } = setup({ data: { error: "Not your fixture." } });
  expect(await logMatch(payload({ in_possession: 4 }))).toEqual({ error: "Not your fixture." });
  expect(calls.some((c) => c.table === "match_results")).toBe(false);
});

it("writes nothing extra when no phase was rated", async () => {
  const { calls } = setup({ data: { success: true } });
  await logMatch(payload());
  expect(calls.some((c) => c.table === "match_results")).toBe(false);
});

it("still saves the result before migration 061 adds the column", async () => {
  setup({ data: { success: true } }, () => ({ error: { code: "PGRST204" } }));
  await logMatch(payload({ out_of_possession: 2 }));
  expect(mockRedirect).toHaveBeenCalled();
});

it("reports any other failure to store the phase ratings", async () => {
  setup({ data: { success: true } }, () => ({ error: { code: "42501", message: "denied" } }));
  const res = await logMatch(payload({ out_of_possession: 2 }));
  expect((res as { error: string }).error).toMatch(/result is saved, but the phase ratings weren't/);
  expect(mockRedirect).not.toHaveBeenCalled();
});
