jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/weekly-digest-data", () => ({ loadDigestFacts: (...a: unknown[]) => mockFacts(...a) }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockFacts = jest.fn();
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockCoachesPlayer = jest.fn();
jest.mock("@/lib/coached-teams", () => ({
  coachesPlayer: (...a: unknown[]) => mockCoachesPlayer(...a),
  getCoachedTeamIds: async () => ["t1"],
}));

import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { approveFamilyMessage, draftMatchStories, draftWeeklyDigests, retractFamilyMessage, saveFamilyMessage } from "../family-messages";

const staff = { id: "u1", role: "coach", academy_id: "ac" };
const fixture = {
  id: "f1", team_id: "t1", opponent: "Hawks", is_home: true,
  match_results: { team_score: 2, opponent_score: 0 },
  match_appearances: [
    { played: true, player_id: "a", players: { full_name: "Sipho Dlamini" } },
    { played: false, player_id: "b", players: [{ full_name: "Bheki Zulu" }] },
  ],
  player_ratings: [{ player_id: "a", rating: 4, note: "Great energy" }],
};

function setup(over: {
  profile?: unknown; fixture?: unknown; existing?: { player_id: string }[]; message?: unknown;
  insertError?: { code?: string } | null; updateError?: { code?: string } | null; existingError?: { code?: string } | null;
} = {}) {
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (op.table === "fixtures") return { data: "fixture" in over ? over.fixture : fixture };
    if (op.table === "profiles") return { data: { full_name: "Coach Khaya" } };
    if (op.table === "family_messages") {
      if (op.action === "insert") return { error: over.insertError ?? null };
      if (op.action === "update") return { error: over.updateError ?? null };
      if (op.one) return { data: "message" in over ? over.message : { id: "m1", player_id: "a", status: "draft", body: "Fine words", academy_id: "ac" } };
      return { data: over.existing ?? [], error: over.existingError ?? null };
    }
    return { data: null };
  });
  mockRequireStaff.mockResolvedValue({ supabase: f.client, user: { id: "u1" }, profile: "profile" in over ? over.profile : staff });
  return { ops };
}
const writes = (ops: FakeOp[], action: string) => ops.filter((o) => o.table === "family_messages" && o.action === action);

beforeEach(() => {
  jest.clearAllMocks();
  mockCoachesPlayer.mockResolvedValue(true);
});

describe("draftMatchStories", () => {
  it("writes one draft per child on the sheet, never approved", async () => {
    const { ops } = setup();
    expect(await draftMatchStories("f1")).toEqual({ created: 2 });
    const rows = writes(ops, "insert")[0].payload as unknown as { player_id: string; status: string; kind: string; ref_key: string; created_by: string; body: string }[];
    expect(rows.map((r) => r.player_id)).toEqual(["a", "b"]);
    expect(rows.every((r) => r.status === "draft" && r.kind === "match_story" && r.ref_key === "f1" && r.created_by === "u1")).toBe(true);
    expect(rows[0].body).toContain("The team won 2-0 against Hawks at home");
  });

  it("skips children who already have a message", async () => {
    const { ops } = setup({ existing: [{ player_id: "a" }] });
    expect(await draftMatchStories("f1")).toEqual({ created: 1 });
    expect((writes(ops, "insert")[0].payload as unknown as { player_id: string }[]).map((r) => r.player_id)).toEqual(["b"]);
  });

  it("writes nothing and says why for non-staff, a missing match, or an unlogged match", async () => {
    const outsider = setup({ profile: null });
    expect((await draftMatchStories("f1")).error).toMatch(/coaches and admins/);
    const none = setup({ fixture: null });
    expect((await draftMatchStories("f1")).error).toMatch(/not found/);
    const empty = setup({ fixture: { ...fixture, match_appearances: [] } });
    expect((await draftMatchStories("f1")).error).toMatch(/Log the match/);
    expect(writes(outsider.ops, "insert")).toHaveLength(0);
    expect(writes(none.ops, "insert")).toHaveLength(0);
    expect(writes(empty.ops, "insert")).toHaveLength(0);
  });

  it("names the migration when the table is not there yet", async () => {
    setup({ existingError: { code: "42P01" } });
    expect((await draftMatchStories("f1")).error).toMatch(/migration 058/);
  });
});

describe("saveFamilyMessage", () => {
  it("saves trimmed words on a draft", async () => {
    const { ops } = setup();
    expect(await saveFamilyMessage("m1", "  New words  ")).toEqual({ success: true });
    expect(writes(ops, "update")[0].payload).toEqual({ body: "New words" });
  });

  it("refuses blank, overlong and already shared messages without writing", async () => {
    const draft = setup();
    expect((await saveFamilyMessage("m1", "   ")).error).toBe("Write something first.");
    expect((await saveFamilyMessage("m1", "x".repeat(1501))).error).toMatch(/too long|a bit long/);
    const shared = setup({ message: { id: "m1", player_id: "a", status: "approved", body: "x", academy_id: "ac" } });
    expect((await saveFamilyMessage("m1", "y")).error).toMatch(/Take it back/);
    expect(writes(draft.ops, "update")).toHaveLength(0);
    expect(writes(shared.ops, "update")).toHaveLength(0);
  });

  it("refuses a child the coach does not coach", async () => {
    mockCoachesPlayer.mockResolvedValue(false);
    const { ops } = setup();
    expect((await saveFamilyMessage("m1", "words")).error).toMatch(/don't coach/);
    expect(writes(ops, "update")).toHaveLength(0);
  });
});

describe("approveFamilyMessage", () => {
  it("shares a kind draft in the coach's name", async () => {
    const { ops } = setup();
    expect(await approveFamilyMessage("m1")).toEqual({ success: true });
    expect(writes(ops, "update")[0].payload).toMatchObject({ status: "approved", approved_by: "u1", approved_by_name: "Coach Khaya" });
  });

  it("stops on negative wording until the coach acknowledges it", async () => {
    const msg = { id: "m1", player_id: "a", status: "draft", body: "He was weak today", academy_id: "ac" };
    const first = setup({ message: msg });
    const res = await approveFamilyMessage("m1");
    expect(res.flagged).toBe(true);
    expect(writes(first.ops, "update")).toHaveLength(0);
    const second = setup({ message: msg });
    expect(await approveFamilyMessage("m1", { acknowledgeWording: true })).toEqual({ success: true });
    expect(writes(second.ops, "update")).toHaveLength(1);
  });

  it("does not approve for a coach who does not coach the child", async () => {
    mockCoachesPlayer.mockResolvedValue(false);
    const { ops } = setup();
    expect((await approveFamilyMessage("m1")).error).toMatch(/don't coach/);
    expect(writes(ops, "update")).toHaveLength(0);
  });
});

describe("retractFamilyMessage", () => {
  it("returns it to draft and clears who approved it", async () => {
    const { ops } = setup();
    expect(await retractFamilyMessage("m1")).toEqual({ success: true });
    expect(writes(ops, "update")[0].payload).toEqual({ status: "draft", approved_by: null, approved_by_name: null, approved_at: null });
  });
});

describe("draftWeeklyDigests", () => {
  const facts = (id: string, attended = 2) => ({
    playerId: id, fullName: `Kid${id} Name`, sessionsHeld: 2, sessionsAttended: attended, matchesPlayed: 0, nextFixture: null, homeChallenge: null,
  });

  it("writes one draft per child with something to say, never approved, keyed on the week's Monday", async () => {
    mockFacts.mockResolvedValue([facts("a"), facts("b"), facts("c", 0)]);
    const { ops } = setup();
    expect(await draftWeeklyDigests("t1")).toEqual({ created: 2 });
    const rows = writes(ops, "insert")[0].payload as unknown as { player_id: string; status: string; kind: string; ref_key: string; body: string }[];
    expect(rows.map((r) => r.player_id)).toEqual(["a", "b"]);
    expect(rows.every((r) => r.status === "draft" && r.kind === "weekly_digest" && /^\d{4}-\d{2}-\d{2}$/.test(r.ref_key))).toBe(true);
    expect(new Date(`${rows[0].ref_key}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it("leaves a child who already has a note alone", async () => {
    mockFacts.mockResolvedValue([facts("a"), facts("b")]);
    const { ops } = setup({ existing: [{ player_id: "a" }] });
    expect(await draftWeeklyDigests("t1")).toEqual({ created: 1 });
    expect((writes(ops, "insert")[0].payload as unknown as { player_id: string }[]).map((r) => r.player_id)).toEqual(["b"]);
  });

  it("refuses a coach for a team they do not coach, and non-staff, without writing", async () => {
    mockFacts.mockResolvedValue([facts("a")]);
    const other = setup();
    expect((await draftWeeklyDigests("t9")).error).toMatch(/don't coach this team/);
    const outsider = setup({ profile: null });
    expect((await draftWeeklyDigests("t1")).error).toMatch(/coaches and admins/);
    expect(writes(other.ops, "insert")).toHaveLength(0);
    expect(writes(outsider.ops, "insert")).toHaveLength(0);
  });

  it("lets an admin write for any team", async () => {
    mockFacts.mockResolvedValue([facts("a")]);
    setup({ profile: { ...staff, role: "admin" } });
    expect(await draftWeeklyDigests("t9")).toEqual({ created: 1 });
  });

  it("names the migration when the table is not there yet, and says so for an empty team", async () => {
    mockFacts.mockResolvedValue([facts("a")]);
    setup({ existingError: { code: "42P01" } });
    expect((await draftWeeklyDigests("t1")).error).toMatch(/migration 058/);
    mockFacts.mockResolvedValue([]);
    setup();
    expect((await draftWeeklyDigests("t1")).error).toMatch(/no players/);
  });
});
