jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: async () => ["t1"] }));

import { recordingSupabase } from "@/test-utils/recording-supabase";
import type { FakeOp } from "@/test-utils/fake-supabase";
import { saveMatchMinutes } from "../match-minutes";

function setup(over: { fixture?: unknown; members?: string[]; upsertError?: { code?: string; message?: string } } = {}) {
  const r = recordingSupabase((op) => {
    if (op.table === "fixtures") return { data: "fixture" in over ? over.fixture : { id: "f1", team_id: "t1" } };
    if (op.table === "team_members") return { data: (over.members ?? ["a", "b"]).map((player_id) => ({ player_id })) };
    if (op.table === "match_appearances") return { error: over.upsertError ?? null };
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: r.client, user: { id: "u1" } });
  return r;
}
const writes = (calls: FakeOp[]) => calls.filter((c) => c.table === "match_appearances" && c.action === "upsert");

beforeEach(() => jest.clearAllMocks());

describe("saveMatchMinutes", () => {
  it("saves each child's minutes for the fixture", async () => {
    const r = setup();
    expect(await saveMatchMinutes("f1", [{ playerId: "a", minutes: 31 }, { playerId: "b", minutes: 0 }])).toEqual({ success: true, count: 2 });
    expect(writes(r.calls)[0].payload).toEqual([
      { fixture_id: "f1", player_id: "a", played: true, minutes_played: 31 },
      { fixture_id: "f1", player_id: "b", played: false, minutes_played: 0 },
    ]);
    expect(r.filtersOn("fixtures", "in")).toEqual([["team_id", ["t1"]]]);
  });

  it("refuses a fixture the coach does not coach, without writing", async () => {
    const r = setup({ fixture: null });
    expect((await saveMatchMinutes("f1", [{ playerId: "a", minutes: 10 }])).error).toMatch(/access denied/);
    expect(writes(r.calls)).toHaveLength(0);
  });

  it("refuses a child who is not in the team's squad", async () => {
    const r = setup({ members: ["a"] });
    expect((await saveMatchMinutes("f1", [{ playerId: "a", minutes: 10 }, { playerId: "x", minutes: 10 }])).error).toMatch(/no longer in the squad/);
    expect(writes(r.calls)).toHaveLength(0);
  });

  it("refuses impossible minutes before touching the database", async () => {
    const r = setup();
    expect((await saveMatchMinutes("f1", [{ playerId: "a", minutes: 151 }])).error).toMatch(/look wrong/);
    expect((await saveMatchMinutes("f1", [{ playerId: "a", minutes: 2.5 }])).error).toMatch(/look wrong/);
    expect((await saveMatchMinutes("f1", [])).error).toMatch(/no minutes/);
    expect(r.calls).toHaveLength(0);
  });

  it("names the migration when the column is not there yet", async () => {
    setup({ upsertError: { code: "PGRST204", message: "no minutes_played" } });
    expect((await saveMatchMinutes("f1", [{ playerId: "a", minutes: 10 }])).error).toMatch(/migration 062/);
  });
});
