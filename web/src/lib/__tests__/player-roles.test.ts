import { PICKABLE_POSITIONS, isRoleFor, positionLabel, rolesFor, validateSlots } from "../player-roles";

describe("player roles", () => {
  it("offers the 17 granular positions and never a legacy one", () => {
    expect(PICKABLE_POSITIONS).toHaveLength(17);
    expect(PICKABLE_POSITIONS.map((p) => p.value)).not.toContain("defender");
  });

  it("gives every pickable position at least one role", () => {
    for (const p of PICKABLE_POSITIONS) expect(rolesFor(p.value).length).toBeGreaterThan(0);
  });

  it("only offers a role in the position it belongs to", () => {
    expect(isRoleFor("cm", "box_to_box")).toBe(true);
    expect(isRoleFor("st", "box_to_box")).toBe(false);
    expect(rolesFor("lb").map((r) => r.id)).toEqual(["overlapping", "inverted", "defensive"]);
    expect(rolesFor("defender")).toEqual([]);
  });

  it("reads a position without its short code", () => {
    expect(positionLabel("cm")).toBe("Central Midfielder");
    expect(positionLabel(null)).toBe("Not set");
  });

  it("accepts one to three slots, with or without a role", () => {
    const r = validateSlots([{ position: "cm", role: "box_to_box" }, { position: "cdm", role: null }, { position: "cam" }]);
    expect(r).toEqual({ ok: true, slots: [
      { position: "cm", role: "box_to_box" }, { position: "cdm", role: null }, { position: "cam", role: null },
    ] });
  });

  it.each([
    ["not a list", "cm"],
    ["nothing chosen", []],
    ["four slots", [{ position: "gk" }, { position: "cb" }, { position: "lb" }, { position: "rb" }]],
    ["a legacy position", [{ position: "defender" }]],
    ["an unknown position", [{ position: "xx" }]],
    ["the same position twice", [{ position: "cm" }, { position: "cm" }]],
    ["a role from another position", [{ position: "st", role: "anchor" }]],
    ["a junk item", [null]],
  ])("refuses %s", (_name, input) => {
    expect(validateSlots(input).ok).toBe(false);
  });
});
