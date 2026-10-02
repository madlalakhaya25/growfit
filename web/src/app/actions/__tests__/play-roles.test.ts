jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
const mockCoached = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: (...a: unknown[]) => mockCoached(...a) }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: (...a: unknown[]) => mockBudget(...a), aiError: () => "friendly" }));
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING" },
  GoogleGenAI: class { models = { generateContent: (...a: unknown[]) => mockGenerate(...a) }; },
}));

import { approvePlayRoles, generatePlayRoles, getMyPlayRole } from "../play-roles";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";
import { FORMATIONS } from "@/lib/formations";
import { AI_MODEL } from "@/lib/ai-models";
import { fingerprintBrief } from "@/lib/ai-artefacts";
import { buildPlayRolesBrief, collectRolePlayers, playRolesHash } from "@/lib/play-roles";

const f = FORMATIONS.find((x) => x.id === "11-4-3-3")!;
const lb = f.slots.findIndex((s) => s.role === "lb");
const playData = {
  tokens: f.slots.map((s, i) => ({
    id: `t${i}`, kind: "player", x: s.x, y: s.y, label: s.role, group: "Defender", ...(i === lb ? { playerId: "p-lb" } : {}),
  })),
  shapes: [{ id: "s1", kind: "run", pts: [{ x: f.slots[lb].x, y: f.slots[lb].y }, { x: 8, y: 50 }] }],
};
const play = { id: "pl1", academy_id: "ac", team_id: "t1", name: "Overlap", data: playData, concept_ids: [], surface: "pitch" };
const member = { players: { id: "p-lb", full_name: "Sipho Dlamini", date_of_birth: "2014-03-01", position: "lb" } };
const roles = { roles: [{ playerId: "p-lb", text: "Run down the left." }] };

interface Setup { play?: unknown; artefact?: Record<string, unknown> | null; members?: unknown[] }
function setup(over: Setup = {}) {
  const writes: FakeOp[] = [];
  const f2 = fakeSupabase((op) => {
    if (op.table === "tactic_plays") return { data: "play" in over ? over.play : play };
    if (op.table === "team_members") return { data: over.members ?? [member] };
    if (op.table === "ai_artefacts" && op.action === "select") return { data: over.artefact ? [over.artefact] : [] };
    if (op.table === "ai_artefacts") { writes.push(op); return { data: { id: "art1", created_at: "2026-10-01T00:00:00Z", kind: "play_roles", data: roles } }; }
    if (op.table === "profiles") return { data: { full_name: "Coach Buhle" } };
    return { data: null };
  });
  mockRequireUser.mockResolvedValue({ supabase: f2.client, user: { id: "u1" } });
  return { writes };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "k";
  mockBudget.mockResolvedValue(null);
  mockCoached.mockResolvedValue(["t1"]);
});

describe("generatePlayRoles", () => {
  it("refuses a play for a team the caller doesn't coach, spending nothing", async () => {
    setup();
    mockCoached.mockResolvedValue(["other"]);
    expect(await generatePlayRoles({ playId: "pl1" })).toEqual({ error: "You don't coach this team." });
    expect(mockBudget).not.toHaveBeenCalled();
  });
  it("refuses a missing play and a film play", async () => {
    setup({ play: null });
    expect((await generatePlayRoles({ playId: "x" })).error).toMatch(/don't coach/);
    setup({ play: { ...play, surface: "film" } });
    expect((await generatePlayRoles({ playId: "pl1" })).error).toMatch(/film/);
  });
  it("needs at least one named player with something drawn", async () => {
    setup({ members: [] });
    expect((await generatePlayRoles({ playId: "pl1" })).error).toMatch(/Draw a run/);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
  it("writes a DRAFT for the play, keyed on the play id, with the play's hash", async () => {
    const { writes } = setup();
    mockGenerate.mockResolvedValue({ text: JSON.stringify({ roles: [{ playerId: "p-lb", text: "Run down the left." }, { playerId: "ghost", text: "x" }] }) });
    const res = await generatePlayRoles({ playId: "pl1" });
    expect(res).toMatchObject({ status: "draft", cached: false, roles: [{ playerId: "p-lb", name: "Sipho", text: "Run down the left." }] });
    const insert = writes.find((w) => w.action === "insert")!;
    expect(insert.payload).toMatchObject({ kind: "play_roles", subject_type: "play", subject_id: "pl1", status: "draft", academy_id: "ac" });
    expect((insert.payload!.data as { roles: unknown[] }).roles).toHaveLength(1);
    const call = mockGenerate.mock.calls[0][0];
    expect(call.config.systemInstruction).toMatch(/never name a weakness/);
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("serves the stored set free when nothing changed", async () => {
    const players = collectRolePlayers(playData, [member.players]);
    const brief = buildPlayRolesBrief({ name: "Overlap", conceptLabels: [] }, players);
    setup({
      artefact: {
        id: "art9", kind: "play_roles", subject_type: "play", subject_id: "pl1", data: { ...roles, playHash: "h" },
        model_id: AI_MODEL, inputs_fingerprint: fingerprintBrief(brief), status: "approved",
        superseded_at: null, created_at: new Date().toISOString(), created_by: "u1",
      },
    });
    const res = await generatePlayRoles({ playId: "pl1" });
    expect(res).toMatchObject({ cached: true, status: "approved", artefactId: "art9" });
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockBudget).not.toHaveBeenCalled();
  });
  it("is over-budget aware and never leaks provider text", async () => {
    setup();
    mockBudget.mockResolvedValue("slow down");
    expect(await generatePlayRoles({ playId: "pl1" })).toEqual({ error: "slow down" });
    mockBudget.mockResolvedValue(null);
    mockGenerate.mockRejectedValue(new Error("secret"));
    expect(await generatePlayRoles({ playId: "pl1" })).toEqual({ error: "friendly" });
  });
  it("says so when the answer has nothing usable", async () => {
    setup();
    mockGenerate.mockResolvedValue({ text: JSON.stringify({ roles: [{ playerId: "ghost", text: "x" }] }) });
    expect((await generatePlayRoles({ playId: "pl1" })).error).toMatch(/Could not read/);
  });
});

describe("approvePlayRoles", () => {
  const art = { id: "a1", kind: "play_roles", subject_type: "play", subject_id: "pl1", status: "draft", superseded_at: null };
  function setupApprove(artefact: unknown) {
    const writes: FakeOp[] = [];
    const f2 = fakeSupabase((op) => {
      if (op.table === "ai_artefacts" && op.action === "select") return { data: artefact };
      if (op.table === "ai_artefacts") { writes.push(op); return {}; }
      if (op.table === "tactic_plays") return { data: { team_id: "t1" } };
      if (op.table === "profiles") return { data: { full_name: "Coach Buhle" } };
      return { data: null };
    });
    mockRequireUser.mockResolvedValue({ supabase: f2.client, user: { id: "u1" } });
    return writes;
  }
  it("approves with the coach's own name", async () => {
    const writes = setupApprove(art);
    expect(await approvePlayRoles("a1")).toEqual({ success: true });
    expect(writes[0].payload).toMatchObject({ status: "approved", approved_by: "u1", approved_by_name: "Coach Buhle" });
  });
  it("won't approve another kind, a superseded set, or a team the caller doesn't coach", async () => {
    let writes = setupApprove({ ...art, kind: "development_plan" });
    expect((await approvePlayRoles("a1")).error).toMatch(/out of date/);
    writes = setupApprove({ ...art, superseded_at: "2026-01-01" });
    expect((await approvePlayRoles("a1")).error).toMatch(/out of date/);
    writes = setupApprove(art);
    mockCoached.mockResolvedValue(["other"]);
    expect((await approvePlayRoles("a1")).error).toMatch(/don't coach/);
    expect(writes).toHaveLength(0);
  });
});

describe("getMyPlayRole", () => {
  const me = { id: "p-lb", full_name: "Sipho Dlamini", date_of_birth: null, position: null };
  function setupPlayer(artefact: unknown, player: unknown = me) {
    const f2 = fakeSupabase((op) => {
      if (op.table === "tactic_plays") return { data: { id: "pl1", name: "Overlap", data: playData, concept_ids: [], team_id: "t1" } };
      if (op.table === "players") return { data: player };
      if (op.table === "ai_artefacts") return { data: artefact ? [artefact] : [] };
      return { data: null };
    });
    mockRequireUser.mockResolvedValue({ supabase: f2.client, user: { id: "u2" } });
  }
  const hash = () => playRolesHash({ name: "Overlap", conceptIds: [] }, collectRolePlayers(playData, [member.players]));
  const artefact = (playHash: string) => ({
    id: "a", kind: "play_roles", subject_type: "play", subject_id: "pl1", status: "approved",
    data: { roles: [{ playerId: "p-lb", text: "Run down the left." }], playHash },
    model_id: "m", inputs_fingerprint: "f", created_at: "2026-10-01T00:00:00Z", created_by: "u1",
  });

  it("shows the player their own approved job", async () => {
    setupPlayer(artefact(hash()));
    expect(await getMyPlayRole("TOKEN")).toEqual({ text: "Run down the left." });
  });
  it("shows nothing when the play changed after approval", async () => {
    setupPlayer(artefact("an-older-hash"));
    expect(await getMyPlayRole("t")).toEqual({ text: null });
  });
  it("shows nothing when there is no approved set, or the viewer isn't a player", async () => {
    setupPlayer(null);
    expect(await getMyPlayRole("t")).toEqual({ text: null });
    setupPlayer(artefact(hash()), null);
    expect(await getMyPlayRole("t")).toEqual({ text: null });
  });
  it("shows a player with no entry of their own nothing", async () => {
    setupPlayer(artefact(hash()), { ...me, id: "someone-else" });
    expect(await getMyPlayRole("t")).toEqual({ text: null });
  });
});
