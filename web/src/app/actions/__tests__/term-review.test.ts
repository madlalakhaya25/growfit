/**
 * A coach places a player in a band for a category. What is tested: who is let
 * in (staff who coach the player), what is refused before any write (a bad
 * band, a bad category, someone else's term), and exactly what is written.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockCoaches = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ coachesPlayer: (...a: unknown[]) => mockCoaches(...a) }));

import { saveTermReview } from "../term-review";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const COACH = { id: "c1", role: "coach", academy_id: "a1" };

function setup(opts: { profile?: typeof COACH | null; coaches?: boolean; termFound?: boolean } = {}) {
  const f = fakeSupabase((op: FakeOp) => {
    if (op.table === "academy_terms") return { data: opts.termFound === false ? null : { id: "t1" } };
    return { data: null };
  });
  mockRequireStaff.mockResolvedValue({
    supabase: f.client,
    user: { id: "c1" },
    profile: opts.profile === undefined ? COACH : opts.profile,
  });
  mockCoaches.mockResolvedValue(opts.coaches ?? true);
  return f;
}
const writes = (f: ReturnType<typeof setup>) => f.calls.filter((c) => c.table === "player_term_reviews");

beforeEach(() => jest.clearAllMocks());

describe("saveTermReview", () => {
  it("upserts one row for the player, term and category", async () => {
    const f = setup();
    const res = await saveTermReview("p1", "t1", "technical", 3);
    expect(res).toEqual({ success: true });
    expect(writes(f)).toHaveLength(1);
    expect(writes(f)[0].action).toBe("upsert");
    expect(writes(f)[0].payload).toMatchObject({ player_id: "p1", term_id: "t1", category: "technical", band: 3, reviewed_by: "c1" });
  });

  it("refuses a band outside 1-4 or an unknown category without writing", async () => {
    const f = setup();
    expect(await saveTermReview("p1", "t1", "technical", 5)).toEqual({ error: "Choose one of the four bands." });
    expect(await saveTermReview("p1", "t1", "speed", 2)).toEqual({ error: "Unknown category." });
    expect(writes(f)).toHaveLength(0);
  });

  it("refuses someone who is not staff", async () => {
    const f = setup({ profile: null });
    expect(await saveTermReview("p1", "t1", "technical", 2)).toEqual({ error: "Only coaches can review a term." });
    expect(writes(f)).toHaveLength(0);
  });

  it("refuses a coach who does not coach the player", async () => {
    const f = setup({ coaches: false });
    const res = await saveTermReview("p1", "t1", "technical", 2);
    expect(res).toEqual({ error: "You can only review players on your teams." });
    expect(writes(f)).toHaveLength(0);
  });

  it("refuses a term from another academy", async () => {
    const f = setup({ termFound: false });
    expect(await saveTermReview("p1", "tX", "technical", 2)).toEqual({ error: "That term was not found." });
    expect(writes(f)).toHaveLength(0);
  });
});
