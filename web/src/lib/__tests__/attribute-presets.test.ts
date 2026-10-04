import { ALL_ATTR_KEYS } from "../attributes";
import {
  LEVELS, LEVEL_SCORE, MAX_OFFSET, ROLE_OFFSETS, levelLabel, levelOf, presetFor, presetScore,
} from "../attribute-presets";
import { ROLES, type RoleId } from "../player-roles";

describe("attribute presets", () => {
  it("has the five levels at 50, 60, 70, 80 and 90", () => {
    expect(LEVELS.map((l) => LEVEL_SCORE[l])).toEqual([50, 60, 70, 80, 90]);
  });

  it("shapes every role, and keeps every nudge within 10 on a real attribute", () => {
    expect(Object.keys(ROLE_OFFSETS).sort()).toEqual(Object.keys(ROLES).sort());
    for (const [role, offsets] of Object.entries(ROLE_OFFSETS)) {
      for (const [key, n] of Object.entries(offsets)) {
        expect(ALL_ATTR_KEYS).toContain(key);
        expect(Math.abs(n as number)).toBeLessThanOrEqual(MAX_OFFSET);
        expect(role).toBeTruthy();
      }
    }
  });

  it("fills the level's base score when there is no role", () => {
    expect(presetScore("excellent", "pace", null)).toBe(80);
  });

  it("moves an attribute by the role's shape and leaves the rest at the base", () => {
    expect(presetScore("good", "stamina", "box_to_box")).toBe(70);
    expect(presetScore("good", "heading", "box_to_box")).toBe(56);
    expect(presetScore("good", "finishing", "box_to_box")).toBe(60);
  });

  it("opposite roles lean opposite ways", () => {
    expect(presetScore("good", "heading", "target")).toBeGreaterThan(presetScore("good", "heading", "false_9"));
  });

  it("never leaves 1 to 99, and caps an out-of-range offset at 10", () => {
    expect(presetScore("elite", "heading", "target")).toBe(99);
    const original = ROLE_OFFSETS.target.heading;
    ROLE_OFFSETS.target.heading = 40;
    expect(presetScore("average", "heading", "target")).toBe(60); // clamped to +10
    ROLE_OFFSETS.target.heading = original;
  });

  it("presets exactly the attributes asked for", () => {
    const p = presetFor("very_good", ["passing", "pace"], "playmaker" as RoleId);
    expect(Object.keys(p).sort()).toEqual(["pace", "passing"]);
    expect(p.passing).toBe(80);
    expect(p.pace).toBe(70);
  });

  it("names the nearest level only when a score is close to one", () => {
    expect(levelOf(79)).toBe("excellent");
    expect(levelOf(55)).toBe("average");
    expect(levelOf(30)).toBeNull();
    expect(levelOf(99)).toBeNull();
  });

  it("labels a score with the age it is judged against", () => {
    expect(levelLabel(80, "U11")).toBe("80, Excellent for U11");
    expect(levelLabel(80, "U15")).toBe("80, Excellent for U15");
    expect(levelLabel(80, "U12")).toBe("80, Excellent for U11");
    expect(levelLabel(33, "U13")).toBe("33");
  });
});
