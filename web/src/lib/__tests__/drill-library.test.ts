import {
  ageGroupFromTeam,
  filterDrills,
  sanitiseAgeGroups,
  sanitiseLibraryTags,
  sanitisePlayersNeeded,
  sanitiseThemes,
  sortDrills,
  tagsFromFormData,
  toggleChip,
} from "../drill-library";

const drill = (name: string, extra: Record<string, unknown> = {}) => ({ name, ...extra });

describe("tag sanitising", () => {
  it("keeps only known age groups, once each, in U11-U13-U15 order", () => {
    expect(sanitiseAgeGroups(["U15", "U9", "U11", "U15", 13])).toEqual(["U11", "U15"]);
    expect(sanitiseAgeGroups("U11")).toEqual([]);
  });

  it("keeps only themes from the fixed list", () => {
    expect(sanitiseThemes(["pressing", "tiki-taka", "passing"])).toEqual(["passing", "pressing"]);
  });

  it("bounds players needed to 1-40 and drops blanks", () => {
    expect(sanitisePlayersNeeded("8")).toBe(8);
    expect(sanitisePlayersNeeded(99)).toBe(40);
    expect(sanitisePlayersNeeded(0)).toBeNull();
    expect(sanitisePlayersNeeded("")).toBeNull();
    expect(sanitisePlayersNeeded("lots")).toBeNull();
  });

  it("sanitises a whole tag set: bad corner, bad play id and long text", () => {
    const tags = sanitiseLibraryTags({
      age_groups: ["U13"],
      themes: ["finishing"],
      four_corner: "spiritual",
      tactic_play_id: "not-a-uuid",
      equipment: `  ${"c".repeat(400)}  `,
      coaching_points: "   ",
    });
    expect(tags).toEqual({
      age_groups: ["U13"],
      themes: ["finishing"],
      four_corner: null,
      players_needed: null,
      equipment: "c".repeat(300),
      coaching_points: null,
      tactic_play_id: null,
    });
    expect(sanitiseLibraryTags({ four_corner: "psychological" }).four_corner).toBe("psychological");
  });
});

describe("ageGroupFromTeam", () => {
  it.each([
    ["U13", "U13"],
    ["u11", "U11"],
    ["Under 15", "U15"],
    ["U-13 Eagles", "U13"],
    ["U9", null],
    ["Seniors", null],
    [null, null],
  ])("%s -> %s", (input, expected) => {
    expect(ageGroupFromTeam(input)).toBe(expected);
  });
});

describe("filterDrills", () => {
  const drills = [
    drill("Rondo 4v1", { age_groups: ["U11", "U13"], themes: ["passing", "receiving"], coaching_points: "Open body shape" }),
    drill("Press the keeper", { age_groups: ["U15"], themes: ["pressing"] }),
    drill("Finishing gates", { age_groups: ["U11"], themes: ["finishing"], equipment: "6 cones, 2 goals" }),
    drill("Old untagged drill", { description: "passing in pairs" }),
  ];

  it("returns everything with no filter", () => {
    expect(filterDrills(drills, {})).toHaveLength(4);
  });

  it("matches every search word across name, notes, equipment and theme names", () => {
    expect(filterDrills(drills, { query: "body open" }).map((d) => d.name)).toEqual(["Rondo 4v1"]);
    expect(filterDrills(drills, { query: "CONES" }).map((d) => d.name)).toEqual(["Finishing gates"]);
    expect(filterDrills(drills, { query: "receiving" }).map((d) => d.name)).toEqual(["Rondo 4v1"]);
    expect(filterDrills(drills, { query: "rondo pressing" })).toEqual([]);
  });

  it("treats chips within a facet as either-or", () => {
    expect(filterDrills(drills, { ageGroups: ["U13", "U15"] }).map((d) => d.name)).toEqual(["Rondo 4v1", "Press the keeper"]);
  });

  it("needs both facets to match when both are set", () => {
    expect(filterDrills(drills, { ageGroups: ["U11"], themes: ["finishing"] }).map((d) => d.name)).toEqual(["Finishing gates"]);
    expect(filterDrills(drills, { ageGroups: ["U15"], themes: ["finishing"] })).toEqual([]);
  });

  it("drops untagged drills once a chip is on", () => {
    expect(filterDrills(drills, { themes: ["passing"] }).map((d) => d.name)).toEqual(["Rondo 4v1"]);
  });
});

describe("sortDrills", () => {
  it("puts academy method drills first, then A to Z, without mutating", () => {
    const input = [
      drill("beta"),
      drill("Zonal pressing", { is_academy_method: true }),
      drill("Alpha"),
      drill("Build-up", { is_academy_method: true }),
    ];
    const sorted = sortDrills(input);
    expect(sorted.map((d) => d.name)).toEqual(["Build-up", "Zonal pressing", "Alpha", "beta"]);
    expect(input[0].name).toBe("beta");
  });
});

describe("toggleChip", () => {
  it("adds then removes", () => {
    expect(toggleChip(["U11"], "U13")).toEqual(["U11", "U13"]);
    expect(toggleChip(["U11", "U13"], "U11")).toEqual(["U13"]);
  });
});

describe("tagsFromFormData", () => {
  it("reads repeated checkboxes and blanks as null", () => {
    const fd = new FormData();
    fd.append("age_groups", "U11");
    fd.append("age_groups", "U15");
    fd.append("themes", "pressing");
    fd.append("four_corner", "");
    fd.append("players_needed", "10");
    expect(tagsFromFormData(fd)).toEqual({
      age_groups: ["U11", "U15"],
      themes: ["pressing"],
      four_corner: null,
      players_needed: "10",
      equipment: null,
      coaching_points: null,
      tactic_play_id: null,
    });
  });
});
