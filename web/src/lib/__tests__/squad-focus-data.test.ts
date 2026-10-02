import { loadSquadFocus } from "@/lib/squad-focus-data";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

const planData = (area: string, category = "technical") => ({
  focusAreas: [{ category, area, why: "" }],
  actions: [{ what: "x", how: "", timesPerWeek: 1, measure: "", milestoneTemplateId: null }],
  reviewDate: "", playerNote: "",
});

function load(handler: (op: FakeOp) => { data?: unknown; error?: { code?: string } | null }) {
  const f = fakeSupabase(handler);
  return loadSquadFocus(f.client as never, "team1");
}

describe("loadSquadFocus", () => {
  it("uses each player's newest plan only", async () => {
    const f = await load((op) =>
      op.table === "team_members"
        ? { data: [{ player_id: "p1" }, { player_id: "p2" }, { player_id: "p3" }] }
        : { data: [
            { subject_id: "p1", data: planData("First touch") },
            { subject_id: "p1", data: planData("Old goal", "mental") },
            { subject_id: "p2", data: planData("first touch") },
          ] }
    );
    expect(f.squadSize).toBe(3);
    expect(f.planned).toBe(2);
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]).toMatchObject({ category: "technical", players: 2, areas: ["First touch"] });
  });

  it("skips a malformed plan row", async () => {
    const f = await load((op) =>
      op.table === "team_members" ? { data: [{ player_id: "p1" }] } : { data: [{ subject_id: "p1", data: { nonsense: true } }] }
    );
    expect(f.planned).toBe(0);
  });

  it("is empty for an empty team, and still knows the squad size on a read error", async () => {
    expect((await load(() => ({ data: [] }))).squadSize).toBe(0);
    const e = await load((op) => (op.table === "team_members" ? { data: [{ player_id: "p1" }] } : { error: { code: "42P01" } }));
    expect(e).toEqual({ rows: [], planned: 0, squadSize: 1 });
  });
});
