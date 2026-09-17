import {
  ALL_ATTR_KEYS,
  ALL_ATTR_SELECT,
  CORE_ATTR_KEYS,
  CORE_ATTR_SELECT,
  EXTENDED_ATTR_KEYS,
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

  it("builds select lists PostgREST can parse", () => {
    expect(CORE_ATTR_SELECT).toBe(
      "pace, shooting, passing, dribbling, defending, physical"
    );
    expect(ALL_ATTR_SELECT.split(", ")).toEqual(ALL_ATTR_KEYS);
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
