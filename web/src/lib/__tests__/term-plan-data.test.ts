import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadTermPlanInputs } from "../term-plan-data";

const term = { id: "tm", name: "Term 4", starts_on: "2026-10-13", ends_on: "2026-12-09" };

function run(over: { terms?: unknown; termsError?: { code?: string } | null } = {}) {
  const f = fakeSupabase((op) => {
    if (op.table === "academy_terms") return { data: over.terms ?? [term], error: over.termsError ?? null };
    if (op.table === "fixtures") return { data: [
      { opponent: "Hawks", fixture_date: "2026-10-18T08:00:00Z", status: "upcoming" },
      { opponent: "Gone FC", fixture_date: "2026-10-25T08:00:00Z", status: "cancelled" },
    ] };
    if (op.table === "training_sessions") return { data: [{ session_date: "2026-10-14T15:00:00Z" }] };
    return { data: null };
  });
  return loadTermPlanInputs(f.client as never, "t1", "ac", "2026-10-05");
}

describe("loadTermPlanInputs", () => {
  it("returns the term, live fixtures by academy day, and the days already trained", async () => {
    const r = await run();
    expect(r.term?.name).toBe("Term 4");
    expect(r.fixtures).toEqual([{ date: "2026-10-18", opponent: "Hawks" }]);
    expect([...r.sessionDates]).toEqual(["2026-10-14"]);
  });
  it("reads an unrun migration as not available, and no terms as available but empty", async () => {
    expect((await run({ termsError: { code: "42P01" } })).available).toBe(false);
    const none = await run({ terms: [] });
    expect(none).toMatchObject({ available: true, term: null });
  });
});
