import { canActOnPlayer, isStaffRole } from "../auth-guards";

const base = {
  userAcademyId: "ac-1",
  playerAcademyId: "ac-1",
  coachedTeamIds: ["t-1"],
  playerTeamIds: ["t-1"],
};

describe("isStaffRole", () => {
  it("admits coach and admin only", () => {
    expect(isStaffRole("coach")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("player")).toBe(false);
    expect(isStaffRole("parent")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole("")).toBe(false);
  });
});

describe("canActOnPlayer", () => {
  it("lets a coach act on a player on one of their teams", () => {
    expect(canActOnPlayer({ ...base, role: "coach" })).toBe(true);
  });

  it("refuses a coach of a different team in the same academy", () => {
    expect(canActOnPlayer({ ...base, role: "coach", coachedTeamIds: ["t-2"] })).toBe(false);
  });

  it("refuses a coach whose player is on no team", () => {
    expect(canActOnPlayer({ ...base, role: "coach", playerTeamIds: [] })).toBe(false);
  });

  it("lets an admin act on any player in their own academy, team or not", () => {
    expect(canActOnPlayer({ ...base, role: "admin", coachedTeamIds: [], playerTeamIds: [] })).toBe(true);
  });

  it("refuses an admin from another academy", () => {
    expect(canActOnPlayer({ ...base, role: "admin", playerAcademyId: "ac-2" })).toBe(false);
  });

  it("refuses a coach from another academy even with a matching team id", () => {
    expect(canActOnPlayer({ ...base, role: "coach", playerAcademyId: "ac-2" })).toBe(false);
  });

  it.each(["player", "parent"])("never lets a %s through", (role) => {
    expect(canActOnPlayer({ ...base, role })).toBe(false);
    expect(canActOnPlayer({ ...base, role, userAcademyId: "ac-1", coachedTeamIds: ["t-1"] })).toBe(false);
  });

  it("fails closed on an unknown role", () => {
    expect(canActOnPlayer({ ...base, role: null })).toBe(false);
    expect(canActOnPlayer({ ...base, role: undefined })).toBe(false);
  });

  it("fails closed when either academy is unknown, rather than matching two nulls", () => {
    expect(canActOnPlayer({ ...base, role: "admin", userAcademyId: null, playerAcademyId: null })).toBe(false);
    expect(canActOnPlayer({ ...base, role: "coach", userAcademyId: null })).toBe(false);
    expect(canActOnPlayer({ ...base, role: "coach", playerAcademyId: null })).toBe(false);
  });
});
