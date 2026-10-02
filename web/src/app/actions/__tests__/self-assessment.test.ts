/**
 * A player rates themself. What is tested: only a player can, only for a real
 * category and a 1-5 answer, only for a term in their own academy, and only
 * their own row is written.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));

import { saveSelfAssessment } from "../self-assessment";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

function setup(opts: { player?: boolean; term?: boolean } = {}) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "players") return { data: opts.player === false ? null : { id: "p1", academy_id: "a1" } };
    if (op.table === "academy_terms") return { data: opts.term === false ? null : { id: "t1" } };
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}
const writes = (f: ReturnType<typeof setup>) => f.calls.filter((c) => c.table === "player_self_assessments");

beforeEach(() => jest.clearAllMocks());

describe("saveSelfAssessment", () => {
  it("writes the player's own answer", async () => {
    const f = setup();
    expect(await saveSelfAssessment("t1", "mental", 4)).toEqual({ success: true });
    expect(writes(f)).toHaveLength(1);
    expect(writes(f)[0].action).toBe("upsert");
    expect(writes(f)[0].payload).toMatchObject({ player_id: "p1", term_id: "t1", category: "mental", rating: 4 });
  });

  it("refuses a bad category or an answer outside 1-5, without writing", async () => {
    const f = setup();
    expect(await saveSelfAssessment("t1", "speed", 3)).toEqual({ error: "Unknown category." });
    expect(await saveSelfAssessment("t1", "mental", 6)).toEqual({ error: "Choose one of the five answers." });
    expect(writes(f)).toHaveLength(0);
  });

  it("refuses someone who is not a player", async () => {
    const f = setup({ player: false });
    expect(await saveSelfAssessment("t1", "mental", 3)).toEqual({ error: "Only players can rate themselves." });
    expect(writes(f)).toHaveLength(0);
  });

  it("refuses a term from another academy", async () => {
    const f = setup({ term: false });
    expect(await saveSelfAssessment("tX", "mental", 3)).toEqual({ error: "That term was not found." });
    expect(writes(f)).toHaveLength(0);
  });
});
