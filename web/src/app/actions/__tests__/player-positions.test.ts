jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireStaff = jest.fn();
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff(), requireUser: () => mockRequireUser() }));
const mockCoaches = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ coachesPlayer: (...a: unknown[]) => mockCoaches(...a) }));

import { setOfficialPositions, setPreferredPositions } from "../player-positions";
import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";

const SLOTS = [{ position: "cm", role: "box_to_box" }, { position: "cdm", role: null }];

function setup(handler: (op: FakeOp) => FakeReply = () => ({ data: null }), staff = true) {
  const f = fakeSupabase(handler);
  mockRequireStaff.mockResolvedValue({ supabase: f.client, user: { id: "u1" }, profile: staff ? { id: "u1", role: "coach", academy_id: "ac" } : null });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  return f;
}

beforeEach(() => { jest.clearAllMocks(); mockCoaches.mockResolvedValue(true); });

describe("setOfficialPositions", () => {
  it("refuses anyone who isn't staff, and a coach of another team's player", async () => {
    const f = setup(undefined, false);
    expect((await setOfficialPositions("p1", SLOTS)).error).toMatch(/Only coaches and admins/);
    setup();
    mockCoaches.mockResolvedValue(false);
    expect((await setOfficialPositions("p1", SLOTS)).error).toMatch(/team you coach/);
    expect(f.calls).toHaveLength(0);
  });

  it("refuses slots that don't validate, before writing anything", async () => {
    const f = setup();
    expect((await setOfficialPositions("p1", [{ position: "st", role: "anchor" }])).error).toMatch(/role/);
    expect(f.calls).toHaveLength(0);
  });

  it("replaces the official list and keeps players.position and secondary_pos in step", async () => {
    const f = setup();
    expect(await setOfficialPositions("p1", SLOTS)).toEqual({ success: true });
    const insert = f.calls.find((c) => c.table === "player_positions" && c.action === "insert");
    expect(insert?.payload).toEqual([
      expect.objectContaining({ player_id: "p1", kind: "official", rank: 1, position: "cm", role: "box_to_box", set_by: "u1" }),
      expect.objectContaining({ player_id: "p1", kind: "official", rank: 2, position: "cdm", role: null }),
    ]);
    expect(f.calls.some((c) => c.table === "player_positions" && c.action === "delete")).toBe(true);
    const update = f.calls.find((c) => c.table === "players" && c.action === "update");
    expect(update?.payload).toEqual({ position: "cm", secondary_pos: "cdm" });
  });

  it("clears secondary_pos when only one position is chosen", async () => {
    const f = setup();
    await setOfficialPositions("p1", [{ position: "gk", role: "shot_stopper" }]);
    expect(f.calls.find((c) => c.table === "players" && c.action === "update")?.payload).toEqual({ position: "gk", secondary_pos: null });
  });

  it("says the database needs updating when migration 066 isn't run", async () => {
    setup((op) => (op.action === "delete" ? { error: { code: "PGRST205" } } : { data: null }));
    expect((await setOfficialPositions("p1", SLOTS)).error).toMatch(/database update/);
  });
});

describe("setPreferredPositions", () => {
  it("refuses a user who is neither the player nor a linked parent", async () => {
    const f = setup((op) => (op.table === "players" || op.table === "parent_player_links" ? { data: null } : { data: null }));
    expect((await setPreferredPositions("p1", SLOTS)).error).toMatch(/yourself or your child/);
    expect(f.calls.some((c) => c.table === "player_positions")).toBe(false);
  });

  it("writes the preferred list for the player, and never touches players.position", async () => {
    const f = setup((op) => (op.table === "players" ? { data: { id: "p1" } } : { data: null }));
    expect(await setPreferredPositions("p1", SLOTS)).toEqual({ success: true });
    expect(f.calls.find((c) => c.action === "insert")?.payload).toEqual([
      expect.objectContaining({ kind: "preferred", rank: 1, position: "cm" }),
      expect.objectContaining({ kind: "preferred", rank: 2, position: "cdm" }),
    ]);
    expect(f.calls.some((c) => c.table === "players" && c.action === "update")).toBe(false);
  });

  it("lets a linked parent write for their child", async () => {
    setup((op) => (op.table === "parent_player_links" ? { data: { player_id: "p1" } } : { data: null }));
    expect(await setPreferredPositions("p1", SLOTS)).toEqual({ success: true });
  });
});
