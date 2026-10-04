/**
 * The academy drill library actions (migration 065). What is tested: who may
 * write (an admin, or a coach of a team in the academy), that only an admin
 * curates the "Academy method", that a session must be on one of the caller's
 * teams, and what reaches the database.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireStaff = jest.fn();
jest.mock("@/lib/auth", () => ({ requireStaff: () => mockRequireStaff() }));
const mockCoachedTeams = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: () => mockCoachedTeams() }));

import {
  addDrillFromLibrary,
  saveDrill,
  setAcademyMethod,
  shareSessionDrillToLibrary,
  updateDrill,
} from "../drills";
import { recordingSupabase } from "@/test-utils/recording-supabase";
import type { FakeOp, FakeReply } from "@/test-utils/fake-supabase";

const ACADEMY = "a1";
const PLAY = "22222222-2222-4222-8222-222222222222";

type Handler = (op: FakeOp) => FakeReply | undefined;

function setup(opts: { role: "coach" | "admin" | null; teams?: string[]; handler?: Handler }) {
  const teams = opts.teams ?? [];
  const r = recordingSupabase((op) => {
    const custom = opts.handler?.(op);
    if (custom) return custom;
    if (op.table === "teams") return { data: teams.map((id) => ({ id })) };
    if (op.action !== "select") return { data: [{ id: "row" }] };
    return { data: op.one ? null : [] };
  });
  mockCoachedTeams.mockResolvedValue(teams);
  mockRequireStaff.mockResolvedValue({
    supabase: r.client,
    user: { id: "u1" },
    profile: opts.role ? { id: "u1", role: opts.role, academy_id: ACADEMY } : null,
  });
  return r;
}

const writes = (r: ReturnType<typeof setup>, table: string, action: FakeOp["action"]) =>
  r.calls.filter((c) => c.table === table && c.action === action).map((c) => c.payload as Record<string, unknown>);

beforeEach(() => jest.clearAllMocks());

describe("saveDrill", () => {
  const input = { name: " Rondo ", category: "technical" as const, age_groups: ["U11", "U9"], themes: ["passing", "magic"] };

  it("refuses a player or parent", async () => {
    const r = setup({ role: null });
    expect(await saveDrill(input)).toEqual({ error: expect.any(String) });
    expect(writes(r, "drill_library", "insert")).toHaveLength(0);
  });

  it("refuses a coach who coaches no team in the academy", async () => {
    const r = setup({ role: "coach", teams: [] });
    expect(await saveDrill(input)).toEqual({ error: expect.any(String) });
    expect(writes(r, "drill_library", "insert")).toHaveLength(0);
  });

  it("saves a coach's drill to their academy with only known tags", async () => {
    const r = setup({ role: "coach", teams: ["t1"] });
    expect(await saveDrill(input)).toEqual({ success: true });
    const [row] = writes(r, "drill_library", "insert");
    expect(row).toMatchObject({ academy_id: ACADEMY, created_by: "u1", name: "Rondo", age_groups: ["U11"], themes: ["passing"] });
    expect(row).not.toHaveProperty("is_academy_method");
  });

  it("refuses a diagram from outside the academy", async () => {
    const r = setup({ role: "coach", teams: ["t1"] });
    expect(await saveDrill({ ...input, tactic_play_id: PLAY })).toEqual({ error: "That play isn't in your academy." });
    expect(writes(r, "drill_library", "insert")).toHaveLength(0);
  });

  it("still saves the drill, without tags, before migration 065 has run", async () => {
    let first = true;
    const r = setup({
      role: "admin",
      handler: (op) => {
        if (op.table === "drill_library" && op.action === "insert" && first) {
          first = false;
          return { error: { code: "PGRST204" } };
        }
        return undefined;
      },
    });
    expect(await saveDrill(input)).toEqual({ success: true });
    const inserts = writes(r, "drill_library", "insert");
    expect(inserts).toHaveLength(2);
    expect(inserts[1]).not.toHaveProperty("themes");
  });
});

describe("setAcademyMethod", () => {
  it("is admin only", async () => {
    const r = setup({ role: "coach", teams: ["t1"] });
    expect(await setAcademyMethod("d1", true)).toEqual({ error: "Only an admin can choose the academy method." });
    expect(writes(r, "drill_library", "update")).toHaveLength(0);
  });

  it("lets an admin mark a drill in their academy", async () => {
    const r = setup({ role: "admin" });
    expect(await setAcademyMethod("d1", true)).toEqual({ success: true });
    expect(writes(r, "drill_library", "update")).toEqual([{ is_academy_method: true }]);
    expect(r.filtersOn("drill_library", "eq")).toEqual(expect.arrayContaining([["academy_id", ACADEMY]]));
  });
});

describe("updateDrill on an academy method drill", () => {
  const curated: Handler = (op) =>
    op.table === "drill_library" && op.action === "select" ? { data: { id: "d1", is_academy_method: true } } : undefined;
  const input = { name: "Rondo", category: "technical" as const };

  it("is refused for a coach", async () => {
    const r = setup({ role: "coach", teams: ["t1"], handler: curated });
    expect(await updateDrill("d1", input)).toEqual({ error: "Only an admin can change an academy method drill." });
    expect(writes(r, "drill_library", "update")).toHaveLength(0);
  });

  it("is allowed for an admin", async () => {
    const r = setup({ role: "admin", handler: curated });
    expect(await updateDrill("d1", input)).toEqual({ success: true });
    expect(writes(r, "drill_library", "update")).toHaveLength(1);
  });
});

describe("addDrillFromLibrary", () => {
  it("only looks for the session among the caller's own teams", async () => {
    const r = setup({ role: "coach", teams: ["t1"] });
    expect(await addDrillFromLibrary("s1", "d1")).toEqual({ error: "Session not found." });
    expect(r.filtersOn("training_sessions", "in")).toEqual([["team_id", ["t1"]]]);
    expect(writes(r, "training_drills", "insert")).toHaveLength(0);
  });

  it("copies the drill and its coaching points into the session plan", async () => {
    const r = setup({
      role: "coach",
      teams: ["t1"],
      handler: (op) => {
        if (op.table === "training_sessions") return { data: { id: "s1" } };
        if (op.table === "drill_library" && op.action === "select") {
          return { data: { name: "Rondo", description: "4v1", video_url: null, duration_minutes: 12, coaching_points: "Open up", equipment: "cones", players_needed: 5, four_corner: "technical" } };
        }
        if (op.table === "training_drills" && op.action === "select") return { data: [{ sort_order: 2 }] };
        return undefined;
      },
    });
    expect(await addDrillFromLibrary("s1", "d1")).toEqual({ success: true });
    const [row] = writes(r, "training_drills", "insert");
    expect(row).toMatchObject({ session_id: "s1", title: "Rondo", sort_order: 3 });
    expect(row.details).toMatchObject({ coachingPoints: "Open up", setup: "5 players · cones", fourCorner: "Technical", durationMinutes: 12 });
    expect(r.filtersOn("drill_library", "eq")).toEqual(expect.arrayContaining([["academy_id", ACADEMY]]));
  });
});

describe("shareSessionDrillToLibrary", () => {
  const sessionDrill = (teamId: string): Handler => (op) =>
    op.table === "training_drills"
      ? { data: { id: "td1", title: "Gates", description: null, video_url: null, details: null, training_sessions: { team_id: teamId } } }
      : undefined;

  it("refuses a drill from a team the coach does not coach", async () => {
    const r = setup({ role: "coach", teams: ["t1"], handler: sessionDrill("t2") });
    expect(await shareSessionDrillToLibrary("td1", { age_groups: ["U11"] })).toEqual({ error: "Drill not found." });
    expect(writes(r, "drill_library", "insert")).toHaveLength(0);
  });

  it("refuses to share the same session drill twice", async () => {
    const r = setup({
      role: "coach",
      teams: ["t1"],
      handler: (op) => (op.table === "drill_library" && op.action === "select" ? { data: [{ id: "lib1" }] } : sessionDrill("t1")(op)),
    });
    expect(await shareSessionDrillToLibrary("td1", {})).toEqual({ error: "This drill is already in the library." });
    expect(writes(r, "drill_library", "insert")).toHaveLength(0);
  });

  it("copies the session drill into the academy library with its tags", async () => {
    const r = setup({ role: "coach", teams: ["t1"], handler: sessionDrill("t1") });
    expect(await shareSessionDrillToLibrary("td1", { age_groups: ["U13"], themes: ["finishing"], category: "tactical" })).toEqual({ success: true });
    const [row] = writes(r, "drill_library", "insert");
    expect(row).toMatchObject({
      academy_id: ACADEMY, name: "Gates", category: "tactical", source_drill_id: "td1", age_groups: ["U13"], themes: ["finishing"],
    });
    expect(row).not.toHaveProperty("is_academy_method");
  });
});
