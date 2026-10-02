import { fakeSupabase } from "@/test-utils/fake-supabase";
import { loadPlanQueue } from "@/lib/plan-queue-data";

const plan = { focusAreas: [{ category: "technical", area: "First touch", why: "w" }], actions: [], playerNote: "n" };

function row(over: Record<string, unknown>) {
  return {
    id: "a1", kind: "development_plan", subject_type: "player", subject_id: "p1", data: plan, prose: null,
    model_id: "m", inputs_fingerprint: "f", status: "draft", created_by: "u", created_at: "2026-10-01T00:00:00Z", ...over,
  };
}

function client(artefacts: unknown[], error: { code: string } | null = null) {
  return fakeSupabase((op) => {
    if (op.table === "team_members") {
      return { data: [{ players: { id: "p2", full_name: "Zed" } }, { players: { id: "p1", full_name: "Ayo" } }, { players: { id: "p3", full_name: "Bo" } }] };
    }
    return { data: artefacts, error };
  }).client as never;
}

describe("loadPlanQueue", () => {
  it("lists the squad by name with each player's plan state and the shared focus areas", async () => {
    const shared = row({ id: "s1", kind: "development_plan_shared", status: "approved", data: { ...plan, focusAreas: [{ category: "tactical", area: "Scanning", why: "w" }] } });
    const snap = await loadPlanQueue(client([row({}), shared, row({ id: "a2", subject_id: "p2", status: "approved" })]), "t1");
    expect(snap.players.map((p) => p.name)).toEqual(["Ayo", "Bo", "Zed"]);
    const [ayo, bo, zed] = snap.players;
    expect(ayo.plan).toMatchObject({ artefactId: "a1", status: "draft" });
    expect(ayo.sharedAreas).toEqual(["Scanning"]);
    expect(bo.plan).toBeNull();
    expect(zed.plan?.status).toBe("approved");
  });

  it("keeps the shared areas apart from the coach plan for the same player", async () => {
    const shared = row({ id: "s1", kind: "development_plan_shared", status: "approved", data: { ...plan, focusAreas: [{ category: "tactical", area: "Scanning", why: "w" }] } });
    const snap = await loadPlanQueue(client([row({}), shared]), "t1");
    expect(snap.players[0].sharedAreas).toEqual(["Scanning"]);
    expect(snap.players[0].plan?.data.focusAreas[0].area).toBe("First touch");
  });

  it("reads a missing table as unavailable, not an error", async () => {
    const snap = await loadPlanQueue(client([], { code: "42P01" }), "t1");
    expect(snap.available).toBe(false);
  });
});
