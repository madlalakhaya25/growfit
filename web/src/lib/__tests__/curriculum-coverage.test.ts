/**
 * Curriculum coverage. What is tested: only sessions inside the window count,
 * a session is counted once per item, objectives are counted apart from
 * training, retired items and other age groups are left out, "not touched" and
 * the percentage follow, and the window is the current term (or 90 days).
 */
import { computeCoverage, coverageWindow } from "../curriculum-coverage";
import type { CurriculumItem } from "../curriculum";

const item = (id: string, over: Partial<CurriculumItem> = {}): CurriculumItem => ({
  id, ageGroup: "U13", category: "technical", title: id, description: null, sortOrder: 0, active: true, ...over,
});
const sess = (id: string, date: string) => ({ id, date });
const link = (itemId: string, linkId: string, linkType = "session") => ({ itemId, linkType, linkId });
const W = { from: "2026-07-21", to: "2026-10-02" };

const only = (r: ReturnType<typeof computeCoverage>, age = "U13") => r.find((g) => g.ageGroup === age)!;
const flat = (r: ReturnType<typeof computeCoverage>) => only(r).categories.flatMap((c) => c.items);

describe("computeCoverage", () => {
  const items = [item("a"), item("b"), item("c", { category: "mental" })];

  it("counts distinct sessions in the window and the latest day", () => {
    const r = computeCoverage(items, [link("a", "s1"), link("a", "s1"), link("a", "s2")], [sess("s1", "2026-08-05"), sess("s2", "2026-09-10")], W);
    const a = flat(r).find((i) => i.item.id === "a")!;
    expect(a.sessions).toBe(2);
    expect(a.lastTrained).toBe("2026-09-10");
  });

  it("ignores sessions outside the window, including future plans, and links to unknown sessions", () => {
    const r = computeCoverage(items, [link("a", "old"), link("a", "future"), link("a", "ghost"), link("a", "edge")],
      [sess("old", "2026-07-20"), sess("future", "2026-10-03"), sess("edge", "2026-10-02")], W);
    expect(flat(r).find((i) => i.item.id === "a")!.sessions).toBe(1);
  });

  it("counts objectives apart from training", () => {
    const r = computeCoverage(items, [link("b", "o1", "objective"), link("b", "o1", "objective"), link("b", "o2", "objective")], [], W);
    const b = flat(r).find((i) => i.item.id === "b")!;
    expect(b.objectives).toBe(2);
    expect(b.sessions).toBe(0);
    expect(b.lastTrained).toBeNull();
  });

  it("lists what was not touched and the share that was", () => {
    const r = computeCoverage(items, [link("a", "s1")], [sess("s1", "2026-08-05")], W);
    expect(only(r).notTouched.map((i) => i.item.id)).toEqual(["b", "c"]);
    expect(only(r).coveragePercent).toBe(33);
  });

  it("leaves out retired items and keeps age groups apart", () => {
    const r = computeCoverage([item("a"), item("x", { active: false }), item("y", { ageGroup: "U15" })], [link("y", "s1")], [sess("s1", "2026-08-05")], W);
    expect(r.map((g) => g.ageGroup)).toEqual(["U13", "U15"]);
    expect(flat(r).map((i) => i.item.id)).toEqual(["a"]);
    expect(only(r, "U15").coveragePercent).toBe(100);
  });

  it("returns nothing for an empty curriculum", () => {
    expect(computeCoverage([], [link("a", "s1")], [sess("s1", "2026-08-05")], W)).toEqual([]);
  });
});

describe("coverageWindow", () => {
  const terms = [
    { starts_on: "2026-07-21", ends_on: "2026-10-02" },
    { starts_on: "2026-10-13", ends_on: "2026-12-09" },
  ];

  it("is the running term up to today", () => {
    expect(coverageWindow(terms, "2026-09-01")).toEqual({ from: "2026-07-21", to: "2026-09-01" });
  });

  it("stops at the end of a term that is over, in the holiday after it", () => {
    expect(coverageWindow(terms, "2026-10-08")).toEqual({ from: "2026-07-21", to: "2026-10-02" });
  });

  it("falls back to the last 90 days with no terms, or before the first term starts", () => {
    expect(coverageWindow([], "2026-10-06")).toEqual({ from: "2026-07-08", to: "2026-10-06" });
    expect(coverageWindow(terms, "2026-06-01")).toEqual({ from: "2026-03-03", to: "2026-06-01" });
  });
});
