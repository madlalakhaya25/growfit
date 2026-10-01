import {
  MILESTONE_CATEGORIES,
  MILESTONE_CATEGORY_META,
  categoryMeta,
  currentSeason,
  summariseByCategory,
  type MilestoneCategory,
} from "../development-categories";

const t = (id: string, category: MilestoneCategory) => ({ id, category });

describe("category order and meta", () => {
  it("has the five categories in migration 012's order", () => {
    expect(MILESTONE_CATEGORIES).toEqual(["technical", "tactical", "physical", "mental", "leadership"]);
  });

  it("gives every category its own tokens, as literal class strings", () => {
    for (const key of MILESTONE_CATEGORIES) {
      const m = MILESTONE_CATEGORY_META[key];
      expect(m.key).toBe(key);
      expect(m.fill).toBe(`bg-dev-${key}`);
      expect(m.chip).toBe(`bg-dev-${key}/10 text-dev-${key}`);
      expect(m.cssVar).toBe(`var(--color-dev-${key})`);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.short.length).toBeLessThanOrEqual(5);
      // identity is never colour alone
      expect(m.Icon).toBeTruthy();
    }
  });

  it("uses no raw Tailwind palette colours", () => {
    const all = JSON.stringify(
      MILESTONE_CATEGORIES.map((k) => [MILESTONE_CATEGORY_META[k].chip, MILESTONE_CATEGORY_META[k].fill])
    );
    expect(all).not.toMatch(/(blue|violet|orange|teal|amber|red|green)-\d{3}/);
  });

  it("never gives one fill a second background class (cn() would drop one)", () => {
    for (const key of MILESTONE_CATEGORIES) {
      expect(MILESTONE_CATEGORY_META[key].fill.split(/\s+/)).toHaveLength(1);
    }
  });
});

describe("categoryMeta", () => {
  it("resolves a known key", () => {
    expect(categoryMeta("mental")?.label).toBe("Mental");
  });
  it("returns null — not a throw, not a default — for anything else", () => {
    expect(categoryMeta("fitness")).toBeNull(); // a drill category, deliberately not a milestone one
    expect(categoryMeta("")).toBeNull();
    expect(categoryMeta(null)).toBeNull();
    expect(categoryMeta(undefined)).toBeNull();
    expect(categoryMeta("toString")).toBeNull();
  });
});

describe("summariseByCategory", () => {
  it("zero templates: no categories and a null percentage, never a misleading 0%", () => {
    expect(summariseByCategory([], new Set())).toEqual({
      overall: { total: 0, done: 0, pct: null },
      byCategory: [],
    });
  });

  it("partial progress, in display order, only categories that have templates", () => {
    const r = summariseByCategory(
      [t("a", "mental"), t("b", "technical"), t("c", "technical"), t("d", "technical"), t("e", "mental")],
      new Set(["b", "e"])
    );
    expect(r.overall).toEqual({ total: 5, done: 2, pct: 40 });
    expect(r.byCategory.map((c) => [c.key, c.done, c.total, c.pct])).toEqual([
      ["technical", 1, 3, 33],
      ["mental", 1, 2, 50],
    ]);
    expect(r.byCategory[0].meta.label).toBe("Technical");
  });

  it("is stable regardless of the order templates arrive in", () => {
    const a = [t("1", "leadership"), t("2", "technical"), t("3", "physical")];
    const done = new Set(["2"]);
    expect(summariseByCategory(a, done)).toEqual(summariseByCategory([...a].reverse(), done));
  });

  it("full completion", () => {
    const r = summariseByCategory([t("a", "tactical"), t("b", "tactical")], new Set(["a", "b"]));
    expect(r.overall.pct).toBe(100);
    expect(r.byCategory[0].pct).toBe(100);
  });

  it("ignores completions for templates that no longer exist", () => {
    const r = summariseByCategory([t("a", "tactical")], new Set(["gone", "also-gone"]));
    expect(r.overall).toEqual({ total: 1, done: 0, pct: 0 });
  });

  it("counts an unknown category nowhere rather than folding it into another", () => {
    const r = summariseByCategory(
      [t("a", "tactical"), { id: "x", category: "fitness" as unknown as MilestoneCategory }],
      new Set(["x"])
    );
    expect(r.overall).toEqual({ total: 1, done: 0, pct: 0 });
    expect(r.byCategory).toHaveLength(1);
  });
});

describe("currentSeason", () => {
  it("is the year in Africa/Johannesburg, not the host's", () => {
    // 23:30 UTC on 31 Dec is already 01:30 on 1 Jan in Durban (UTC+2).
    expect(currentSeason(new Date("2026-12-31T23:30:00Z"))).toBe("2027");
    expect(currentSeason(new Date("2026-06-15T10:00:00Z"))).toBe("2026");
  });
});
