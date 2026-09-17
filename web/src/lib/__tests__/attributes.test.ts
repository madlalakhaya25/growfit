import {
  ALL_ATTR_KEYS,
  ALL_ATTR_SELECT,
  CORE_ATTR_KEYS,
  CORE_ATTR_SELECT,
  EXTENDED_ATTR_KEYS,
  calculateOverall,
  getPositionAttrKeys,
  isMissingAttributeColumn,
  getPositionAttrs,
} from "@/lib/attributes";

describe("attribute key sets", () => {
  it("splits every key into either the core six or the expanded set", () => {
    expect(CORE_ATTR_KEYS).toHaveLength(6);
    expect(EXTENDED_ATTR_KEYS).toHaveLength(ALL_ATTR_KEYS.length - 6);
    expect([...CORE_ATTR_KEYS, ...EXTENDED_ATTR_KEYS].sort()).toEqual(
      [...ALL_ATTR_KEYS].sort()
    );
  });

  it("keeps the core six to the columns migration 001 created", () => {
    expect(CORE_ATTR_KEYS).toEqual([
      "pace", "shooting", "passing", "dribbling", "defending", "physical",
    ]);
  });

  it("puts agility in the expanded set, since migration 013 added it", () => {
    expect(EXTENDED_ATTR_KEYS).toContain("agility");
    expect(CORE_ATTR_KEYS).not.toContain("agility");
  });

  it("only ever asks for attributes that exist in the position map", () => {
    const set = getPositionAttrs("gk");
    for (const key of [...set.technical, ...set.physical, ...set.mental]) {
      expect(ALL_ATTR_KEYS).toContain(key);
    }
  });
});

describe("isMissingAttributeColumn", () => {
  it("matches PostgREST's write-side schema-cache miss", () => {
    expect(
      isMissingAttributeColumn({
        code: "PGRST204",
      })
    ).toBe(true);
  });

  it("matches Postgres' own undefined_column, which a wide SELECT raises", () => {
    expect(isMissingAttributeColumn({ code: "42703" })).toBe(true);
  });

  it("does not swallow unrelated failures", () => {
    expect(isMissingAttributeColumn({ code: "42501" })).toBe(false); // RLS denial
    expect(isMissingAttributeColumn({ code: "23514" })).toBe(false); // check violation
    expect(isMissingAttributeColumn({})).toBe(false);
    expect(isMissingAttributeColumn(null)).toBe(false);
    expect(isMissingAttributeColumn(undefined)).toBe(false);
  });
});

describe("getPositionAttrKeys", () => {
  it("returns every attribute the form renders, without duplicates", () => {
    const set = getPositionAttrs("st");
    const keys = getPositionAttrKeys("st");
    expect(keys).toEqual([
      ...new Set([...set.technical, ...set.physical, ...set.mental]),
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to the default set for an unknown position", () => {
    expect(getPositionAttrKeys("libero")).toEqual(getPositionAttrKeys(null));
  });
});

describe("calculateOverall", () => {
  it("averages the attributes the position is actually assessed on", () => {
    const attrs = Object.fromEntries(ALL_ATTR_KEYS.map((k) => [k, 10]));
    for (const key of getPositionAttrKeys("gk")) attrs[key] = 90;
    // A fixed core-six average would be dragged down by the 10s; a
    // position-aware one sees only the 90s.
    expect(calculateOverall(attrs, "gk")).toBe(90);
  });

  it("moves when any slider the coach can see moves — the reported bug", () => {
    const gkKeys = getPositionAttrKeys("gk");
    const before = Object.fromEntries(gkKeys.map((k) => [k, 50]));
    for (const key of gkKeys) {
      const after = { ...before, [key]: 99 };
      expect(calculateOverall(after, "gk")).toBeGreaterThan(
        calculateOverall(before, "gk")!
      );
    }
  });

  it("ignores attributes that were never rated", () => {
    // Only two of the keeper's attributes assessed; the rest are null.
    const keys = getPositionAttrKeys("gk");
    const attrs: Record<string, number | null> = Object.fromEntries(
      keys.map((k) => [k, null])
    );
    attrs[keys[0]] = 80;
    attrs[keys[1]] = 60;
    expect(calculateOverall(attrs, "gk")).toBe(70);
  });

  it("returns null when nothing relevant is assessed, so callers can fall back", () => {
    expect(calculateOverall(null, "gk")).toBeNull();
    expect(calculateOverall({}, "gk")).toBeNull();
    expect(calculateOverall({ shooting: 90 }, "gk")).toBeNull();
  });
});

describe("select constants stay in step with the key arrays", () => {
  // They are spelled out as literals so supabase-js can parse them at the type
  // level; these assertions are what stops that duplication drifting.
  it("ALL_ATTR_SELECT matches ALL_ATTR_KEYS", () => {
    expect(ALL_ATTR_SELECT).toBe(ALL_ATTR_KEYS.join(", "));
  });

  it("CORE_ATTR_SELECT matches CORE_ATTR_KEYS", () => {
    expect(CORE_ATTR_SELECT).toBe(CORE_ATTR_KEYS.join(", "));
  });
});
