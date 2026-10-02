import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { loadDigestFacts } from "../weekly-digest-data";

const NOW = new Date("2026-10-08T10:00:00Z");

function setup(over: { sessions?: unknown[]; attendance?: unknown[]; appearances?: unknown[]; upcoming?: unknown[]; plan?: unknown } = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    switch (op.table) {
      case "team_members": return { data: [{ players: { id: "b", full_name: "Bheki Zulu" } }, { players: { id: "a", full_name: "Ayanda Nkosi" } }] };
      case "training_sessions": return { data: over.sessions ?? [{ id: "s1" }, { id: "s2" }] };
      case "training_attendance": return { data: over.attendance ?? [{ player_id: "a", status: "present" }, { player_id: "a", status: "late" }, { player_id: "b", status: "absent" }, { player_id: "b", status: "excused" }] };
      case "fixtures": return { data: op.payload ? null : (over.upcoming ?? [{ id: "f1", opponent: "Hawks", fixture_date: "2026-10-11T08:00:00Z" }]) };
      case "match_appearances": return { data: over.appearances ?? [{ player_id: "a", played: true }, { player_id: "b", played: false }] };
      default: return { data: null };
    }
  });
  return { ops, client: f.client };
}

describe("loadDigestFacts", () => {
  it("counts present and late as attended, played matches, in name order", async () => {
    const { client } = setup();
    const facts = await loadDigestFacts(client as never, "t1", "2026-10-05", NOW);
    expect(facts.map((x) => x.playerId)).toEqual(["a", "b"]);
    expect(facts[0]).toMatchObject({ sessionsHeld: 2, sessionsAttended: 2, matchesPlayed: 1 });
    expect(facts[1]).toMatchObject({ sessionsHeld: 2, sessionsAttended: 0, matchesPlayed: 0 });
    expect(facts[0].nextFixture?.opponent).toBe("Hawks");
    expect(facts[0].homeChallenge).toBeNull();
  });

  it("asks for nothing when the team has no sessions or matches this week", async () => {
    const { client, ops } = setup({ sessions: [] });
    const facts = await loadDigestFacts(client as never, "t1", "2026-10-05", NOW);
    expect(facts[0].sessionsHeld).toBe(0);
    expect(ops.some((o) => o.table === "training_attendance")).toBe(false);
  });

  it("returns nothing for an empty team", async () => {
    const f = fakeSupabase(() => ({ data: [] }));
    expect(await loadDigestFacts(f.client as never, "t1", "2026-10-05", NOW)).toEqual([]);
  });
});
