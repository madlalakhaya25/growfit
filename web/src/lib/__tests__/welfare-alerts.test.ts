import { loadWelfareAlerts } from "../welfare-alerts";
import { fakeSupabase } from "@/test-utils/fake-supabase";

const asClient = (c: unknown) => c as never;

describe("loadWelfareAlerts", () => {
  it("looks at no teams and queries nothing when given none", async () => {
    const f = fakeSupabase(() => ({ data: [] }));
    expect(await loadWelfareAlerts(asClient(f.client), [])).toEqual({ alerts: [] });
    expect(f.calls).toHaveLength(0);
  });

  it("flags a player below the threshold on the teams it is given, lowest first, with the last check-in", async () => {
    const f = fakeSupabase((op) => {
      if (op.table === "teams") return { data: [{ id: "t1", name: "U13" }] };
      if (op.table === "team_members") return { data: [
        { team_id: "t1", players: { id: "a", full_name: "Low" } },
        { team_id: "t1", players: { id: "b", full_name: "Fine" } },
      ] };
      if (op.table === "training_sessions") return { data: [{ id: "s1" }, { id: "s2" }, { id: "s3" }, { id: "s4" }] };
      if (op.table === "training_attendance") return { data: [
        ...["present", "absent", "absent", "absent"].map((status) => ({ player_id: "a", status })),
        ...["present", "present", "late", "present"].map((status) => ({ player_id: "b", status })),
      ] };
      if (op.table === "welfare_checkins") return { data: [{ player_id: "a", note: "n", created_at: "2026-09-20T00:00:00Z", noted_by: "u", profiles: { full_name: "Buhle" } }] };
      return { data: [] };
    });
    const res = await loadWelfareAlerts(asClient(f.client), ["t1"]);
    expect(res.alerts).toHaveLength(1);
    expect(res.alerts[0]).toMatchObject({
      playerId: "a", fullName: "Low", teamName: "U13", attendancePct: 25, sessionsAssessed: 4,
      lastCheckin: { note: "n", loggedBy: "Buhle" },
    });
  });

  it("has nothing to say when no session was held in the window", async () => {
    const f = fakeSupabase((op) => {
      if (op.table === "team_members") return { data: [{ team_id: "t1", players: { id: "a", full_name: "A" } }] };
      return { data: [] };
    });
    expect(await loadWelfareAlerts(asClient(f.client), ["t1"])).toEqual({ alerts: [] });
  });
});
