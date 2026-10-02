import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadReadiness } from "../readiness-data";

const NOW = new Date("2026-10-07T12:00:00Z");
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

// Eight sessions over four weeks; this week's two are much harder than the rest.
const days = [1, 3, 8, 10, 15, 17, 22, 24];
const sessions = days.map((d, i) => ({ id: `s${i}`, session_date: ago(d) }));
const attendance = (withRpe: boolean, absentRecently = false) =>
  days.map((d, i) => ({ session_id: `s${i}`, player_id: "p1", status: absentRecently && d <= 3 ? "absent" : "present", ...(withRpe ? { rpe: d <= 3 ? 9 : 4 } : {}) }));
const ratings = [4, 4, 4, 2, 2, 2].map((rating, i) => ({ player_id: "p1", rating, created_at: ago(60 - i * 5) }));

function client(opts: { rpeColumn: boolean; absentRecently?: boolean }) {
  let attendanceCalls = 0;
  return fakeSupabase((op) => {
    if (op.table === "training_sessions") return { data: sessions };
    if (op.table === "fixtures") return { data: [] };
    if (op.table === "player_ratings") return { data: ratings };
    if (op.table === "training_attendance") {
      attendanceCalls++;
      if (!opts.rpeColumn && attendanceCalls === 1) return { error: { code: "42703", message: "no rpe" } };
      return { data: attendance(opts.rpeColumn, opts.absentRecently) };
    }
    return { data: [] };
  }).client as never;
}

describe("loadReadiness", () => {
  it("flags a load spike and slipping ratings from what was recorded", async () => {
    const { byPlayer, effortRecorded } = await loadReadiness(client({ rpeColumn: true }), "t1", "U13", [{ id: "p1", attendancePct: 0.9 }], NOW);
    expect(effortRecorded).toBe(true);
    expect(byPlayer.get("p1")).toMatchObject({ level: "check-in", flags: ["load-spike", "ratings"] });
  });

  it("gives a child no load for a session they were absent from", async () => {
    const { byPlayer } = await loadReadiness(client({ rpeColumn: true, absentRecently: true }), "t1", "U13", [{ id: "p1", attendancePct: 0.9 }], NOW);
    expect(byPlayer.get("p1")!.flags).not.toContain("load-spike");
  });

  it("carries on without effort when the column is not there yet", async () => {
    const { byPlayer, effortRecorded } = await loadReadiness(client({ rpeColumn: false }), "t1", "U13", [{ id: "p1", attendancePct: 0.9 }], NOW);
    expect(effortRecorded).toBe(false);
    expect(byPlayer.get("p1")).toMatchObject({ flags: ["ratings"], acwr: null, needsEffortRatings: true });
  });

  it("returns nothing for an empty squad", async () => {
    const out = await loadReadiness(client({ rpeColumn: true }), "t1", "U13", [], NOW);
    expect(out.byPlayer.size).toBe(0);
  });
});
