/**
 * Skill challenges. What is tested: only a coach of the team can set or remove
 * a challenge (and a named player must be in that team); a player logs only
 * their own score; a parent only for a linked child; bad scores are refused
 * before anything is written; a missing table (migration 064 not run) reads as
 * "not set up yet", not a crash.
 */
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: () => mockRequireUser() }));
const mockCoached = jest.fn();
jest.mock("@/lib/coached-teams", () => ({ getCoachedTeamIds: () => mockCoached() }));

import { assignSkillChallenge, logSkillChallengeAttempt, removeSkillChallengeAssignment } from "../skill-challenges";
import { fakeSupabase, type FakeOp, type FakeReply } from "@/test-utils/fake-supabase";
import { addDays } from "@/lib/week-plan";
import { todayIso } from "@/lib/time";

function setup(handler: (op: FakeOp) => FakeReply | undefined, coached: string[] = ["t1"]) {
  const f = fakeSupabase((op) => handler(op) ?? { data: null });
  mockRequireUser.mockResolvedValue({ supabase: f.client, user: { id: "u1" } });
  mockCoached.mockResolvedValue(coached);
  return f;
}
const writesTo = (f: ReturnType<typeof setup>, table: string) =>
  f.calls.filter((c) => c.table === table && c.action !== "select");

const due = addDays(todayIso(), 7);

beforeEach(() => jest.clearAllMocks());

describe("assignSkillChallenge", () => {
  const coachDb = (op: FakeOp): FakeReply | undefined => {
    if (op.table === "teams") return { data: { id: "t1", academy_id: "a1" } };
    if (op.table === "team_members") return { data: { player_id: "p1" } };
    return undefined;
  };

  it("lets a coach of the team set a challenge for the whole team", async () => {
    const f = setup(coachDb);
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "keepy_uppies", dueOn: due })).toEqual({ success: true });
    const w = writesTo(f, "skill_challenge_assignments");
    expect(w).toHaveLength(1);
    expect(w[0].payload).toMatchObject({ academy_id: "a1", team_id: "t1", player_id: null, challenge_key: "keepy_uppies", due_on: due, created_by: "u1" });
  });

  it("can target one player in the team", async () => {
    const f = setup(coachDb);
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "cone_weave", dueOn: due, playerId: "p1" })).toEqual({ success: true });
    expect(writesTo(f, "skill_challenge_assignments")[0].payload).toMatchObject({ player_id: "p1" });
  });

  it("refuses a coach who does not coach the team", async () => {
    const f = setup(coachDb, ["other"]);
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "keepy_uppies", dueOn: due })).toEqual({
      error: "You can only set challenges for a team you coach.",
    });
    expect(writesTo(f, "skill_challenge_assignments")).toHaveLength(0);
  });

  it("refuses a player who is not in the team", async () => {
    const f = setup((op) => (op.table === "team_members" ? { data: null } : coachDb(op)));
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "keepy_uppies", dueOn: due, playerId: "px" })).toEqual({
      error: "That player isn't in this team.",
    });
    expect(writesTo(f, "skill_challenge_assignments")).toHaveLength(0);
  });

  it("refuses an unknown challenge or a bad or past date before touching the database", async () => {
    const f = setup(coachDb);
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "nope", dueOn: due })).toEqual({ error: "Pick a challenge from the list." });
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "keepy_uppies", dueOn: "soon" })).toEqual({ error: "Pick a due date." });
    expect(await assignSkillChallenge({ teamId: "t1", challengeKey: "keepy_uppies", dueOn: "2020-01-01" })).toEqual({
      error: "The due date has already passed.",
    });
    expect(f.calls).toHaveLength(0);
  });

  it("says the feature is not set up yet when migration 064 has not run", async () => {
    setup((op) => (op.table === "skill_challenge_assignments" ? { error: { code: "PGRST205" } } : coachDb(op)));
    const res = await assignSkillChallenge({ teamId: "t1", challengeKey: "keepy_uppies", dueOn: due });
    expect(res.error).toMatch(/migration 064/);
  });
});

describe("removeSkillChallengeAssignment", () => {
  it("lets a coach of the team remove it", async () => {
    const f = setup((op) => (op.table === "skill_challenge_assignments" && op.action === "select" ? { data: { id: "s1", team_id: "t1" } } : undefined));
    expect(await removeSkillChallengeAssignment("s1")).toEqual({ success: true });
    expect(writesTo(f, "skill_challenge_assignments").map((c) => c.action)).toEqual(["delete"]);
  });

  it("refuses a coach of another team", async () => {
    const f = setup(
      (op) => (op.table === "skill_challenge_assignments" && op.action === "select" ? { data: { id: "s1", team_id: "t1" } } : undefined),
      ["t2"]
    );
    expect(await removeSkillChallengeAssignment("s1")).toEqual({ error: "You can only change challenges for a team you coach." });
    expect(writesTo(f, "skill_challenge_assignments")).toHaveLength(0);
  });
});

describe("logSkillChallengeAttempt", () => {
  it("writes a player's own score", async () => {
    const f = setup((op) => (op.table === "players" ? { data: { id: "p1" } } : undefined));
    expect(await logSkillChallengeAttempt("keepy_uppies", 42)).toEqual({ success: true });
    const w = writesTo(f, "skill_challenge_attempts");
    expect(w).toHaveLength(1);
    expect(w[0].payload).toEqual({ player_id: "p1", challenge_key: "keepy_uppies", value: 42, logged_by: "u1" });
  });

  it("refuses someone who is not a player", async () => {
    const f = setup(() => undefined);
    expect(await logSkillChallengeAttempt("keepy_uppies", 42)).toEqual({ error: "Only players can log their own scores." });
    expect(writesTo(f, "skill_challenge_attempts")).toHaveLength(0);
  });

  it("lets a linked parent log for their child", async () => {
    const f = setup((op) => (op.table === "parent_player_links" ? { data: { player_id: "kid" } } : undefined));
    expect(await logSkillChallengeAttempt("cone_weave", 19, "kid")).toEqual({ success: true });
    expect(writesTo(f, "skill_challenge_attempts")[0].payload).toMatchObject({ player_id: "kid", logged_by: "u1" });
    expect(f.calls.some((c) => c.table === "players")).toBe(false);
  });

  it("refuses a parent who is not linked to the child", async () => {
    const f = setup(() => undefined);
    expect(await logSkillChallengeAttempt("cone_weave", 19, "someone-else")).toEqual({ error: "You can only log scores for your own child." });
    expect(writesTo(f, "skill_challenge_attempts")).toHaveLength(0);
  });

  it("refuses a bad score or an unknown challenge before writing", async () => {
    const f = setup((op) => (op.table === "players" ? { data: { id: "p1" } } : undefined));
    expect(await logSkillChallengeAttempt("keepy_uppies", -3)).toEqual({ error: "Enter a whole number." });
    expect(await logSkillChallengeAttempt("cone_weave", 0)).toEqual({ error: "Enter a time in whole seconds." });
    expect(await logSkillChallengeAttempt("made_up", 5)).toEqual({ error: "Pick a challenge from the list." });
    expect(f.calls).toHaveLength(0);
  });

  it("says the feature is not set up yet when migration 064 has not run", async () => {
    setup((op) => {
      if (op.table === "players") return { data: { id: "p1" } };
      if (op.table === "skill_challenge_attempts") return { error: { code: "42P01" } };
      return undefined;
    });
    const res = await logSkillChallengeAttempt("keepy_uppies", 10);
    expect(res.error).toMatch(/migration 064/);
  });
});
