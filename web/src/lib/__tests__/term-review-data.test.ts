import { loadTermReview } from "@/lib/term-review-data";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const TERMS = [
  { id: "t1", name: "Term 1 2026", starts_on: "2026-01-14", ends_on: "2026-03-27" },
  { id: "t2", name: "Term 2 2026", starts_on: "2026-04-08", ends_on: "2026-06-26" },
];

function load(handler: (op: FakeOp) => { data?: unknown; error?: { code?: string } | null }, today = "2026-05-01") {
  const f = fakeSupabase(handler);
  return loadTermReview(f.client as never, "p1", "a1", today);
}

describe("loadTermReview", () => {
  it("returns this term's and last term's bands", async () => {
    const snap = await load((op) =>
      op.table === "academy_terms"
        ? { data: TERMS }
        : { data: [
            { term_id: "t2", category: "technical", band: 3 },
            { term_id: "t1", category: "technical", band: 2 },
            { term_id: "t1", category: "mental", band: 4 },
            { term_id: "t2", category: "bogus", band: 3 },
            { term_id: "t2", category: "tactical", band: 9 },
          ] }
    );
    expect(snap.available).toBe(true);
    expect(snap.term?.id).toBe("t2");
    expect(snap.previous?.id).toBe("t1");
    expect(snap.current).toEqual({ technical: 3 });
    expect(snap.last).toEqual({ technical: 2, mental: 4 });
  });

  it("is unavailable, not an error, when a table is missing", async () => {
    expect((await load(() => ({ error: { code: "42P01" } }))).available).toBe(false);
    const noReviews = await load((op) => (op.table === "academy_terms" ? { data: TERMS } : { error: { code: "PGRST205" } }));
    expect(noReviews.available).toBe(false);
  });

  it("has no term to review when none are set up", async () => {
    const snap = await load(() => ({ data: [] }));
    expect(snap.available).toBe(true);
    expect(snap.term).toBeNull();
  });
});
