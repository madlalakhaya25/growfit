import { DRILL_CATEGORIES, drillCategoryForCorner, drillCategoryFromSessionKind, isDrillCategory } from "../drill-taxonomy";
import { MILESTONE_CATEGORIES } from "../development-categories";

describe("drill taxonomy boundaries", () => {
  it("keeps the library's six categories exactly as migration 012 defines them", () => {
    expect([...DRILL_CATEGORIES]).toEqual(["warm_up", "technical", "tactical", "physical", "small_sided", "cool_down"]);
    expect(isDrillCategory("physical")).toBe(true);
    expect(isDrillCategory("fitness")).toBe(false);
  });
  it("maps the session page's three kinds, with fitness meaning physical", () => {
    expect(drillCategoryFromSessionKind("technical")).toBe("technical");
    expect(drillCategoryFromSessionKind("tactical")).toBe("tactical");
    expect(drillCategoryFromSessionKind("fitness")).toBe("physical");
    expect(drillCategoryFromSessionKind("physical")).toBeNull();
    expect(drillCategoryFromSessionKind("")).toBeNull();
  });
  it("maps only the three corners that have a drill category", () => {
    const mapped = MILESTONE_CATEGORIES.map((c) => [c, drillCategoryForCorner(c)]);
    expect(mapped).toEqual([
      ["technical", "technical"], ["tactical", "tactical"], ["physical", "physical"], ["mental", null], ["leadership", null],
    ]);
  });
  it("never returns a value outside the library's own categories", () => {
    for (const c of MILESTONE_CATEGORIES) {
      const m = drillCategoryForCorner(c);
      expect(m === null || isDrillCategory(m)).toBe(true);
    }
  });
});
