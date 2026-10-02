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

import { loadSquadReview } from "@/lib/term-review-data";

describe("loadSquadReview", () => {
  const roster = [
    { players: { id: "p2", full_name: "Bheki" } },
    { players: [{ id: "p1", full_name: "Ayanda" }] },
  ];
  function squad(extra?: (op: FakeOp) => { data?: unknown; error?: { code?: string } | null } | undefined) {
    const f = fakeSupabase((op) => {
      const o = extra?.(op);
      if (o) return o;
      if (op.table === "academy_terms") return { data: TERMS };
      if (op.table === "team_members") return { data: roster };
      return { data: [
        { player_id: "p1", term_id: "t2", category: "technical", band: 3 },
        { player_id: "p1", term_id: "t1", category: "technical", band: 1 },
        { player_id: "p2", term_id: "t1", category: "mental", band: 2 },
      ] };
    });
    return loadSquadReview(f.client as never, "team1", "a1", "2026-05-01");
  }

  it("lists the squad by name with each child's own bands", async () => {
    const s = await squad();
    expect(s.players.map((p) => p.name)).toEqual(["Ayanda", "Bheki"]);
    expect(s.players[0].current).toEqual({ technical: 3 });
    expect(s.players[0].last).toEqual({ technical: 1 });
    expect(s.players[1].current).toEqual({});
    expect(s.players[1].last).toEqual({ mental: 2 });
  });

  it("is unavailable when the reviews table is missing", async () => {
    const s = await squad((op) => (op.table === "player_term_reviews" ? { error: { code: "42P01" } } : undefined));
    expect(s.available).toBe(false);
  });

  it("handles a team with no active players", async () => {
    const s = await squad((op) => (op.table === "team_members" ? { data: [] } : undefined));
    expect(s.available).toBe(true);
    expect(s.players).toEqual([]);
  });
});
