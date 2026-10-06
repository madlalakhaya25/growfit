import {
  ageGroupsWithItems, cleanCurriculumInput, curriculumIsEmpty, groupForAgeGroup, nextSortOrder, normalizeAgeGroup,
  swapWithNeighbour, curriculumAgeGroupFromTeam, cleanLinkRequest, itemsForTeam, type CurriculumItem,
} from "../curriculum";

const item = (over: Partial<CurriculumItem> = {}): CurriculumItem => ({
  id: "a", ageGroup: "U13", category: "technical", title: "Receive on the back foot",
  description: null, sortOrder: 0, active: true, ...over,
});

describe("normalizeAgeGroup", () => {
  it("tidies a label and refuses what cannot be one", () => {
    expect(normalizeAgeGroup("u13")).toBe("U13");
    expect(normalizeAgeGroup("  u  11 ")).toBe("U 11");
    expect(normalizeAgeGroup("Senior")).toBe("SENIOR");
    expect(normalizeAgeGroup("")).toBeNull();
    expect(normalizeAgeGroup("U")).toBeNull();
    expect(normalizeAgeGroup("U13; DROP TABLE")).toBeNull();
    expect(normalizeAgeGroup("A".repeat(13))).toBeNull();
    expect(normalizeAgeGroup(13)).toBeNull();
  });
});

describe("cleanCurriculumInput", () => {
  const ok = { ageGroup: "u13", category: "tactical", title: "  Press as a unit ", description: "  When the ball goes wide.  " };

  it("cleans a good submission", () => {
    expect(cleanCurriculumInput(ok)).toEqual({ ageGroup: "U13", category: "tactical", title: "Press as a unit", description: "When the ball goes wide." });
  });

  it("treats a blank or missing description as none", () => {
    expect(cleanCurriculumInput({ ...ok, description: "   " })?.description).toBeNull();
    expect(cleanCurriculumInput({ ...ok, description: undefined })?.description).toBeNull();
    expect(cleanCurriculumInput({ ...ok, description: null })?.description).toBeNull();
  });

  it("refuses an unknown category, a missing title or age group, and anything that is not an object", () => {
    expect(cleanCurriculumInput({ ...ok, category: "fitness" })).toBeNull();
    expect(cleanCurriculumInput({ ...ok, title: "   " })).toBeNull();
    expect(cleanCurriculumInput({ ...ok, ageGroup: "" })).toBeNull();
    expect(cleanCurriculumInput({ ...ok, description: 5 })).toBeNull();
    expect(cleanCurriculumInput(null)).toBeNull();
    expect(cleanCurriculumInput([ok])).toBeNull();
    expect(cleanCurriculumInput("x")).toBeNull();
  });

  it("refuses over-long text instead of cutting it, and allows the exact limits", () => {
    expect(cleanCurriculumInput({ ...ok, title: "t".repeat(201) })).toBeNull();
    expect(cleanCurriculumInput({ ...ok, title: "t".repeat(200) })?.title).toHaveLength(200);
    expect(cleanCurriculumInput({ ...ok, description: "d".repeat(601) })).toBeNull();
    expect(cleanCurriculumInput({ ...ok, description: "d".repeat(600) })?.description).toHaveLength(600);
  });
});

describe("groupForAgeGroup", () => {
  it("returns all five categories in fixed order, empty ones included", () => {
    const groups = groupForAgeGroup([item()], "U13");
    expect(groups.map((g) => g.category)).toEqual(["technical", "tactical", "physical", "mental", "leadership"]);
    expect(groups.map((g) => g.items.length)).toEqual([1, 0, 0, 0, 0]);
  });

  it("keeps to the age group asked for, whatever its spelling, and leaves retired items out", () => {
    const items = [item({ id: "1" }), item({ id: "2", ageGroup: "U11" }), item({ id: "3", ageGroup: "u13" }), item({ id: "4", active: false })];
    expect(groupForAgeGroup(items, "u13")[0].items.map((i) => i.id)).toEqual(["1", "3"]);
  });

  it("orders by sort order, then title, then id, so the same data always reads the same", () => {
    const items = [
      item({ id: "z", title: "B", sortOrder: 1 }),
      item({ id: "y", title: "A", sortOrder: 1 }),
      item({ id: "x", title: "Z", sortOrder: 0 }),
      item({ id: "w", title: "A", sortOrder: 1 }),
    ];
    expect(groupForAgeGroup(items, "U13")[0].items.map((i) => i.id)).toEqual(["x", "w", "y", "z"]);
  });

  it("does not reorder the list it was given", () => {
    const items = [item({ id: "b", sortOrder: 2 }), item({ id: "a", sortOrder: 1 })];
    groupForAgeGroup(items, "U13");
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("ageGroupsWithItems", () => {
  it("lists the age groups that have an active item, U11 before U13 before U15, each once", () => {
    const items = [item({ ageGroup: "U15" }), item({ ageGroup: "u11" }), item({ ageGroup: "U13" }), item({ ageGroup: "U13" }), item({ ageGroup: "U9", active: false })];
    expect(ageGroupsWithItems(items)).toEqual(["U11", "U13", "U15"]);
  });

  it("sorts numbers as numbers", () => {
    expect(ageGroupsWithItems([item({ ageGroup: "U9" }), item({ ageGroup: "U11" })])).toEqual(["U9", "U11"]);
  });
});

describe("nextSortOrder", () => {
  it("is 0 for an empty group and one past the highest otherwise", () => {
    expect(nextSortOrder([], "U13", "technical")).toBe(0);
    const items = [item({ sortOrder: 4 }), item({ id: "b", sortOrder: 2 }), item({ id: "c", category: "mental", sortOrder: 9 }), item({ id: "d", ageGroup: "U11", sortOrder: 7 })];
    expect(nextSortOrder(items, "U13", "technical")).toBe(5);
  });

  it("counts retired items too, so a retired item's place is never reused", () => {
    expect(nextSortOrder([item({ sortOrder: 3, active: false })], "U13", "technical")).toBe(4);
  });
});

describe("curriculumIsEmpty", () => {
  it("is true until there is an active item", () => {
    expect(curriculumIsEmpty([])).toBe(true);
    expect(curriculumIsEmpty([item({ active: false })])).toBe(true);
    expect(curriculumIsEmpty([item()])).toBe(false);
  });
});

describe("swapWithNeighbour", () => {
  const mk = (id: string, sortOrder: number, over: Partial<CurriculumItem> = {}): CurriculumItem => ({
    id, ageGroup: "U13", category: "technical", title: id, description: null, sortOrder, active: true, ...over,
  });
  const list = [mk("a", 0), mk("b", 1), mk("c", 2)];

  it("swaps with the item above or below", () => {
    expect(swapWithNeighbour(list, "b", "up")).toEqual([{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 1 }]);
    expect(swapWithNeighbour(list, "b", "down")).toEqual([{ id: "b", sortOrder: 2 }, { id: "c", sortOrder: 1 }]);
  });

  it("does nothing at either end, for a retired or unknown item", () => {
    expect(swapWithNeighbour(list, "a", "up")).toBeNull();
    expect(swapWithNeighbour(list, "c", "down")).toBeNull();
    expect(swapWithNeighbour([...list, mk("d", 3, { active: false })], "d", "up")).toBeNull();
    expect(swapWithNeighbour(list, "zzz", "up")).toBeNull();
  });

  it("only swaps within the same age group and heading, and skips retired neighbours", () => {
    const mixed = [mk("a", 0), mk("x", 1, { ageGroup: "U15" }), mk("y", 1, { category: "mental" }), mk("r", 1, { active: false }), mk("b", 2)];
    expect(swapWithNeighbour(mixed, "b", "up")).toEqual([{ id: "b", sortOrder: 0 }, { id: "a", sortOrder: 2 }]);
  });

  it("renumbers a pair that shares a position, so the move still happens", () => {
    const tied = [mk("a", 0), mk("b", 0)];
    const moves = swapWithNeighbour(tied, "b", "up")!;
    expect(moves.find((m) => m.id === "b")!.sortOrder).toBeLessThan(moves.find((m) => m.id === "a")!.sortOrder);
  });
});

describe("linking helpers", () => {
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const mk = (id: string, over: Partial<CurriculumItem> = {}): CurriculumItem => ({
    id, ageGroup: "U13", category: "technical", title: id, description: null, sortOrder: 0, active: true, ...over,
  });

  it("reads the age group a team's label names", () => {
    expect(curriculumAgeGroupFromTeam("U13")).toBe("U13");
    expect(curriculumAgeGroupFromTeam("Under 15 Girls")).toBe("U15");
    expect(curriculumAgeGroupFromTeam("u-11")).toBe("U11");
    expect(curriculumAgeGroupFromTeam("Seniors")).toBeNull();
    expect(curriculumAgeGroupFromTeam(null)).toBeNull();
  });

  it("accepts a clean request, removes repeats, and refuses anything malformed", () => {
    expect(cleanLinkRequest("session", A, [B, B])).toEqual({ linkType: "session", linkId: A, itemIds: [B] });
    expect(cleanLinkRequest("objective", A, [])).toEqual({ linkType: "objective", linkId: A, itemIds: [] });
    expect(cleanLinkRequest("drill", A, [B])).toBeNull();
    expect(cleanLinkRequest("session", "nope", [B])).toBeNull();
    expect(cleanLinkRequest("session", A, ["nope"])).toBeNull();
    expect(cleanLinkRequest("session", A, "x")).toBeNull();
    expect(cleanLinkRequest("session", A, Array.from({ length: 21 }, (_, i) => `${i}`.padStart(8, "0") + "-1111-4111-8111-111111111111"))).toBeNull();
  });

  it("keeps only active items of the team's own age group", () => {
    const items = [mk(A), mk(B, { ageGroup: "U15" }), mk("c", { active: false })];
    expect(itemsForTeam(items, "U13", [A, B, "c", "zzz"])).toEqual([A]);
    expect(itemsForTeam(items, null, [A])).toEqual([]);
  });
});
