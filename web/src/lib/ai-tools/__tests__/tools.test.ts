import { MY_TEAM, OTHER_ACADEMY, OTHER_TEAM, P1, P2, makeCtx, playerReplies } from "@/test-utils/agent-tools";
import { getSquad } from "../get-squad";
import { getPlayer } from "../get-player";
import { getAttendance } from "../get-attendance";
import { getFixtures } from "../get-fixtures";
import { getMilestones } from "../get-milestones";
import { getDocumentStatus } from "../get-document-status";
import { searchDrills, sanitiseDrillQuery } from "../search-drills";
import { getWelfareAlerts } from "../get-welfare-alerts";
import { DOCUMENTS } from "@/lib/document-definitions";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockWelfare = jest.fn();
jest.mock("@/app/actions/welfare", () => ({ getWelfareAlerts: (...a: unknown[]) => mockWelfare(...a) }));
const mockSnapshot = jest.fn();
jest.mock("@/lib/development-data", () => ({ loadDevelopmentSnapshot: (...a: unknown[]) => mockSnapshot(...a) }));

describe("getSquad", () => {
  it("filters the query by the caller's team ids and returns names only", async () => {
    const { ctx, calls } = makeCtx(() => ({
      data: [{ team_id: MY_TEAM, teams: { name: "U13" }, players: { id: P1, full_name: "Sipho", position: "winger" } }],
    }));
    const out = await getSquad.run(ctx, {});
    expect(out.players).toEqual([
      { playerId: P1, name: "Sipho", team: "U13", position: "winger", href: `/dashboard/coach/squad/${P1}` },
    ]);
    expect(calls[0].table).toBe("team_members");
    expect(getSquad.links!(out)).toEqual([{ label: "Sipho", href: `/dashboard/coach/squad/${P1}`, match: ["Sipho"] }]);
  });
  it("returns nothing, and never queries, for a team outside ctx.teamIds", async () => {
    const { ctx, calls } = makeCtx(() => ({ data: [] }));
    expect(await getSquad.run(ctx, { teamId: OTHER_TEAM })).toEqual({ players: [], truncated: false });
    expect(calls).toHaveLength(0);
  });
  it("rejects malformed args", () => {
    expect(getSquad.parseInput({ teamId: "nope" })).toBeNull();
    expect(getSquad.parseInput("x")).toBeNull();
    expect(getSquad.parseInput({})).toEqual({});
  });
});

describe("getPlayer", () => {
  it("refuses a player outside the caller's teams, without reading the profile", async () => {
    const { ctx, calls } = makeCtx((op) => playerReplies(op, { teams: [OTHER_TEAM] }) ?? { data: [] });
    const out = await getPlayer.run(ctx, { playerId: P1 });
    expect(out).toEqual({ error: expect.stringContaining("isn't on a team") });
    // only the two authorisation reads happened
    expect(calls.every((c) => c.table === "players" || c.table === "team_members")).toBe(true);
    expect(calls.filter((c) => c.table === "players")).toHaveLength(1);
  });
  it("refuses a player in another academy even on a shared team id", async () => {
    const { ctx } = makeCtx((op) => playerReplies(op, { academy: OTHER_ACADEMY }) ?? { data: [] });
    expect(await getPlayer.run(ctx, { playerId: P1 })).toHaveProperty("error");
  });
  it("refuses a parent or player role outright", async () => {
    const { ctx } = makeCtx((op) => playerReplies(op) ?? { data: [] }, { role: "parent" });
    expect(await getPlayer.run(ctx, { playerId: P1 })).toHaveProperty("error");
  });
  it("returns the profile without sensitive fields for a coached player", async () => {
    let playerReads = 0;
    const { ctx, calls } = makeCtx((op) => {
      // 1st players read = authorisePlayer; 2nd = the profile select.
      if (op.table === "players" && op.one && playerReads++ > 0) {
        return { data: { id: P1, full_name: "Sipho", position: "midfielder", secondary_pos: null, preferred_foot: "left" } };
      }
      return playerReplies(op) ?? { data: [{ teams: { name: "U13" } }] };
    });
    const out = await getPlayer.run(ctx, { playerId: P1 });
    expect(out).toMatchObject({ name: "Sipho", preferredFoot: "left" });
    const sel = calls.find((c) => c.table === "players" && c.one);
    expect(JSON.stringify(out)).not.toMatch(/date_of_birth|photo|share_token/);
    expect(sel).toBeDefined();
  });
  it("rejects a non-uuid", () => {
    expect(getPlayer.parseInput({ playerId: "1; drop table" })).toBeNull();
    expect(getPlayer.parseInput(null)).toBeNull();
  });
});

describe("getAttendance", () => {
  it("rejects both playerId and teamId, and bad days", () => {
    expect(getAttendance.parseInput({ playerId: P1, teamId: MY_TEAM })).toBeNull();
    expect(getAttendance.parseInput({ days: "ninety" })).toBeNull();
    expect(getAttendance.parseInput({ days: 9999 })).toMatchObject({ days: 180 });
  });
  it("refuses a player-scoped read outside the caller's teams", async () => {
    const { ctx } = makeCtx((op) => playerReplies(op, { teams: [OTHER_TEAM] }) ?? { data: [] });
    expect(await getAttendance.run(ctx, { playerId: P1, days: 90 })).toHaveProperty("error");
  });
  it("summarises with the academy policy, lowest first, not-assessed last", async () => {
    const { ctx, calls } = makeCtx((op) => {
      if (op.table === "team_members")
        return { data: [{ players: { id: P1, full_name: "A" } }, { players: { id: P2, full_name: "B" } }, { players: { id: "x", full_name: "C" } }] };
      if (op.table === "training_sessions") return { data: [{ id: "s1" }, { id: "s2" }] };
      if (op.table === "training_attendance")
        return {
          data: [
            { player_id: P1, status: "present" },
            { player_id: P1, status: "present" },
            { player_id: P2, status: "absent" },
            { player_id: P2, status: "present" },
            { player_id: P2, status: "excused" },
          ],
        };
      return { data: [] };
    });
    const out = await getAttendance.run(ctx, { days: 90 });
    if (!("players" in out)) throw new Error("expected rows");
    expect(out.players.map((p) => [p.name, p.pct])).toEqual([["B", 50], ["A", 100], ["C", null]]);
    expect(out.players[0].belowThreshold).toBe(true);
    expect(calls.map((c) => c.table)).toEqual(["team_members", "training_sessions", "training_attendance"]);
  });
  it("short-circuits for a team outside ctx.teamIds", async () => {
    const { ctx, calls } = makeCtx(() => ({ data: [] }));
    const out = await getAttendance.run(ctx, { teamId: OTHER_TEAM, days: 30 });
    expect(out).toMatchObject({ players: [], sessions: 0 });
    expect(calls).toHaveLength(0);
  });
});

describe("getFixtures", () => {
  it("returns scores for completed fixtures and clamps the limit", async () => {
    const { ctx, calls } = makeCtx(() => ({
      data: [
        { id: "f1", opponent: "Rovers", fixture_date: "2026-09-01T10:00:00Z", venue: null, is_home: true, status: "completed",
          teams: { name: "U13" }, match_results: { team_score: 3, opponent_score: 1 } },
        { id: "f2", opponent: "United", fixture_date: "2026-10-05T10:00:00Z", venue: "Field 2", is_home: false, status: "upcoming",
          teams: { name: "U13" }, match_results: null },
      ],
    }));
    const out = await getFixtures.run(ctx, { limit: 10 });
    expect(out.fixtures[0].score).toEqual({ team: 3, opponent: 1 });
    expect(out.fixtures[1].score).toBeNull();
    expect(calls[0].table).toBe("fixtures");
    expect(getFixtures.parseInput({ limit: 500 })).toMatchObject({ limit: 20 });
  });
  it("rejects an unknown status and ignores other teams", async () => {
    expect(getFixtures.parseInput({ status: "deleted" })).toBeNull();
    const { ctx, calls } = makeCtx(() => ({ data: [] }));
    expect(await getFixtures.run(ctx, { teamId: OTHER_TEAM, limit: 5 })).toEqual({ fixtures: [] });
    expect(calls).toHaveLength(0);
  });
  it("gives an admin no fixture links (there is no admin fixture route)", async () => {
    const { ctx } = makeCtx(
      () => ({ data: [{ id: "f1", opponent: "R", fixture_date: "d", venue: null, is_home: true, status: "upcoming", teams: null, match_results: null }] }),
      { role: "admin" }
    );
    expect(getFixtures.links!(await getFixtures.run(ctx, { limit: 5 }))).toEqual([]);
  });
});

describe("getMilestones", () => {
  it("refuses a player outside the caller's teams before loading any milestones", async () => {
    mockSnapshot.mockClear();
    const { ctx } = makeCtx((op) => playerReplies(op, { teams: [OTHER_TEAM] }) ?? { data: [] });
    expect(await getMilestones.run(ctx, { playerId: P1 })).toHaveProperty("error");
    expect(mockSnapshot).not.toHaveBeenCalled();
  });
  it("returns titles and completion only, never the coach's notes", async () => {
    mockSnapshot.mockResolvedValue({
      templates: [
        { id: "t1", title: "First touch", category: "technical" },
        { id: "t2", title: "Scan before receiving", category: "tactical" },
      ],
      currentSeason: "2026",
      completedThisSeason: new Set(["t1"]),
      currentNotes: { t1: "Private: struggling at home" },
      loadError: null,
    });
    const { ctx } = makeCtx((op) => playerReplies(op) ?? { data: [] });
    const out = await getMilestones.run(ctx, { playerId: P1 });
    expect(out).toMatchObject({ completed: 1, total: 2, season: "2026" });
    expect(JSON.stringify(out)).not.toContain("Private");
  });
});

describe("getDocumentStatus", () => {
  it("lists outstanding documents by label, using only type and status", async () => {
    const { ctx, calls } = makeCtx((op) => {
      if (op.table === "team_members") return { data: [{ players: { id: P1, full_name: "A" } }, { players: { id: P2, full_name: "B" } }] };
      if (op.table === "player_documents") return { data: [{ player_id: P1, document_type: "registration_agreement", status: "signed" }] };
      return { data: [] };
    });
    const out = await getDocumentStatus.run(ctx, {});
    if (!("players" in out)) throw new Error("expected rows");
    const a = out.players.find((p) => p.name === "A")!;
    const b = out.players.find((p) => p.name === "B")!;
    expect(b.outstanding).toHaveLength(DOCUMENTS.length);
    expect(a.outstanding).toHaveLength(DOCUMENTS.length - 1);
    expect(out.players[0].name).toBe("B");
    expect(calls.find((c) => c.table === "player_documents")).toBeDefined();
  });
  it("refuses an out-of-team player and rejects ambiguous args", async () => {
    const { ctx } = makeCtx((op) => playerReplies(op, { teams: [OTHER_TEAM] }) ?? { data: [] });
    expect(await getDocumentStatus.run(ctx, { playerId: P1 })).toHaveProperty("error");
    expect(getDocumentStatus.parseInput({ playerId: P1, teamId: MY_TEAM })).toBeNull();
  });
});

describe("getWelfareAlerts", () => {
  it("drops the check-in note and keeps only when it was logged", async () => {
    mockWelfare.mockResolvedValue({
      alerts: [{
        playerId: P1, fullName: "A", teamName: "U13", attendancePct: 60, sessionsAssessed: 10,
        lastCheckin: { note: "Parent ill, taxi issues", createdAt: "2026-09-20T00:00:00Z", loggedBy: "Buhle" },
      }],
    });
    const { ctx } = makeCtx(() => ({ data: [] }));
    const out = await getWelfareAlerts.run(ctx, {});
    expect(JSON.stringify(out)).not.toMatch(/taxi|Buhle/);
    expect(out).toMatchObject({ alerts: [{ attendancePct: 60, lastCheckInAt: "2026-09-20T00:00:00Z" }] });
  });
  it("turns an action error into a fixed message, not the raw error", async () => {
    mockWelfare.mockResolvedValue({ error: "relation welfare_checkins does not exist" });
    const { ctx } = makeCtx(() => ({ data: [] }));
    expect(JSON.stringify(await getWelfareAlerts.run(ctx, {}))).not.toContain("relation");
  });
});

describe("searchDrills", () => {
  it("maps the session page's `fitness` to the library's `physical`, at this boundary only", () => {
    expect(searchDrills.parseInput({ category: "fitness" })).toMatchObject({ category: "physical" });
  });
  it("turns a development corner into a library category in the query", async () => {
    const { ctx, calls } = makeCtx(() => ({ data: [] }));
    await searchDrills.run(ctx, { corner: "physical", limit: 5 });
    expect(calls).toHaveLength(1);
  });
  it("says there is no drill category for mental or leadership, without querying", async () => {
    const { ctx, calls } = makeCtx(() => ({ data: [] }));
    const out = await searchDrills.run(ctx, { corner: "mental", limit: 5 });
    expect(out.drills).toEqual([]);
    expect(out.note).toMatch(/no drill category for mental/);
    expect(calls).toHaveLength(0);
  });
  it("validates category and strips filter syntax from the query", () => {
    expect(searchDrills.parseInput({ category: "cardio" })).toBeNull();
    expect(searchDrills.parseInput({ category: "technical", developmentCorner: "physical" })).toBeNull();
    expect(searchDrills.parseInput({ developmentCorner: "speed" })).toBeNull();
    expect(searchDrills.parseInput({ query: 5 })).toBeNull();
    expect(sanitiseDrillQuery("a,b%c(d)*")).toBe("a b c d");
    expect(searchDrills.parseInput({ query: "rondo,id.eq.1", category: "small_sided" })).toMatchObject({
      query: "rondo id.eq.1",
      category: "small_sided",
    });
  });
  it("queries only the caller's academy and never runs without one", async () => {
    const { ctx, calls } = makeCtx(() => ({ data: [{ id: "d1", name: "Rondo", description: null, category: "small_sided", duration_minutes: 15, difficulty: "beginner" }] }));
    const out = await searchDrills.run(ctx, { limit: 5 });
    expect(out.drills[0]).toMatchObject({ drillId: "d1", durationMinutes: 15 });
    expect(calls[0].table).toBe("drill_library");
    const none = makeCtx(() => ({ data: [] }), { academyId: null });
    expect(await searchDrills.run(none.ctx, { limit: 5 })).toEqual({ drills: [] });
    expect(none.calls).toHaveLength(0);
  });
});
