import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadCurves } from "../curves-data";

const NOW = new Date("2026-10-15T10:00:00Z");

function client(att: unknown[]) {
  return fakeSupabase((op) => {
    if (op.table === "player_ratings") return { data: [{ rating: 4, created_at: "2026-10-02T00:00:00Z" }] };
    if (op.table === "player_milestone_completions") return { data: [{ completed_at: "2026-10-03T00:00:00Z" }, { completed_at: null }] };
    if (op.table === "training_attendance") return { data: att };
    return { data: [] };
  }).client as never;
}

describe("loadCurves", () => {
  it("joins ratings, milestones and register marks into this month's point", async () => {
    const c = await loadCurves(client([
      { status: "present", training_sessions: { session_date: "2026-10-01T16:00:00Z" } },
      { status: "absent", training_sessions: [{ session_date: "2026-10-08T16:00:00Z" }] },
    ]), "p1", NOW);
    expect(c.points.at(-1)).toMatchObject({ rating: 4, attendancePct: 50, milestones: 1 });
  });

  it("drops register marks with no session date or from before the window", async () => {
    const c = await loadCurves(client([
      { status: "present", training_sessions: null },
      { status: "present", training_sessions: { session_date: "2025-01-01T16:00:00Z" } },
    ]), "p1", NOW);
    expect(c.points.every((p) => p.attendancePct === null)).toBe(true);
  });
});
