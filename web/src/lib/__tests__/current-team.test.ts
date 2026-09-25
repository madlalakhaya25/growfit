import { resolveCurrentTeam, resolveCurrentTeamId } from "@/lib/current-team";

describe("resolveCurrentTeamId", () => {
  const teams = [{ id: "u11" }, { id: "u13" }, { id: "u15" }];

  it("returns null for an empty team list", () => {
    expect(resolveCurrentTeamId([], "u13", "u15")).toBeNull();
  });

  it("prefers an explicit ?team= param that matches a real team", () => {
    expect(resolveCurrentTeamId(teams, "u13", "u15")).toBe("u13");
  });

  it("falls through to the cookie when the param matches no team", () => {
    expect(resolveCurrentTeamId(teams, "not-a-team", "u15")).toBe("u15");
  });

  it("falls through to the cookie when there is no param at all", () => {
    expect(resolveCurrentTeamId(teams, null, "u15")).toBe("u15");
  });

  it("falls back to the first team when neither param nor cookie match", () => {
    expect(resolveCurrentTeamId(teams, "gone", "also-gone")).toBe("u11");
    expect(resolveCurrentTeamId(teams, null, null)).toBe("u11");
  });
});

describe("resolveCurrentTeam", () => {
  const teams = [
    { id: "u11", name: "U11" },
    { id: "u13", name: "U13" },
  ];

  it("returns the matching team object, not just its id", () => {
    expect(resolveCurrentTeam(teams, "u13", null)).toEqual({ id: "u13", name: "U13" });
  });

  it("returns null for an empty list", () => {
    expect(resolveCurrentTeam([], "u13", null)).toBeNull();
  });
});
