import {
  ALL_ATTR_KEYS,
  averageAttributeRows,
  buildAttributeSnapshot,
  describeAttributes,
  ATTR_CATEGORIES,
  ATTR_META,
  CATEGORY_LABELS,
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
      ...new Set(ATTR_CATEGORIES.flatMap((category) => set[category])),
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

describe("the five corners", () => {
  // These must match development_milestone_templates.category (migration 012).
  // If attributes and milestones drift apart again, the platform is describing
  // a player's development in two different vocabularies.
  it("matches the milestone categories exactly", () => {
    expect(ATTR_CATEGORIES).toEqual([
      "technical", "tactical", "physical", "mental", "leadership",
    ]);
  });

  it("labels every corner", () => {
    for (const category of ATTR_CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
  });

  it("partitions every attribute into exactly one corner", () => {
    const counts = new Map<string, number>();
    for (const key of ALL_ATTR_KEYS) {
      const category = ATTR_META[key].category;
      expect(ATTR_CATEGORIES).toContain(category);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    // Nothing orphaned into a corner that is never displayed.
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    expect(total).toBe(ALL_ATTR_KEYS.length);
  });

  it("puts game understanding in tactical, not mental", () => {
    expect(ATTR_META.positioning.category).toBe("tactical");
    expect(ATTR_META.decision_making.category).toBe("tactical");
    // Psychology stays mental.
    expect(ATTR_META.composure.category).toBe("mental");
    expect(ATTR_META.work_rate.category).toBe("mental");
    // Leadership is its own milestone category, so it is its own corner.
    expect(ATTR_META.leadership.category).toBe("leadership");
  });

  it("gives every position a tactical corner", () => {
    for (const position of ["gk", "cb", "lb", "cdm", "cm", "cam", "lw", "st", "ss", null]) {
      const set = getPositionAttrs(position);
      expect(set.tactical.length).toBeGreaterThan(0);
    }
  });
});

describe("attribute labels", () => {
  it("are unique, so two sliders can never read the same", () => {
    // `physical` and `strength` both read "Strength" before migration 033 —
    // latent, because no position set showed `physical`, but a trap for any
    // future set that did.
    const labels = ALL_ATTR_KEYS.map((key) => ATTR_META[key].label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("position sets stay honest", () => {
  it("reference only real attribute keys", () => {
    for (const position of Object.keys(ATTR_META).concat(["gk", "st", "unknown", ""])) {
      for (const key of getPositionAttrKeys(position)) {
        expect(ALL_ATTR_KEYS).toContain(key);
      }
    }
  });

  it("never show the same attribute twice on one form", () => {
    for (const position of ["gk", "cb", "lb", "lwb", "cdm", "cm", "lm", "cam", "lw", "st", "ss", null]) {
      const keys = getPositionAttrKeys(position);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("averageAttributeRows", () => {
  it("averages each attribute over the coaches who rated it, not over every row", () => {
    // Two coaches. Only one rated agility. Averaging over both rows would
    // halve it; a coach leaving it blank has said nothing, not "low".
    const rows = [
      { pace: 80, agility: 90 },
      { pace: 60, agility: null },
    ];
    const averaged = averageAttributeRows(rows)!;
    expect(averaged.pace).toBe(70);
    expect(averaged.agility).toBe(90);
  });

  it("omits an attribute nobody rated, so unrated stays distinguishable from 50", () => {
    const averaged = averageAttributeRows([{ pace: 70, marking: null }])!;
    expect(averaged.pace).toBe(70);
    expect("marking" in averaged).toBe(false);
  });

  it("returns null for no assessments at all", () => {
    expect(averageAttributeRows([])).toBeNull();
    expect(averageAttributeRows(null)).toBeNull();
    expect(averageAttributeRows(undefined)).toBeNull();
  });

  it("feeds calculateOverall so every surface agrees", () => {
    const rows = [{ pace: 80 }, { pace: 60 }];
    const averaged = averageAttributeRows(rows);
    // Whatever the surface, the same two inputs must give the same number.
    expect(calculateOverall(averaged, "st")).toBe(calculateOverall({ pace: 70 }, "st"));
  });
});

describe("buildAttributeSnapshot", () => {
  it("keeps a goalkeeper's defaulted outfield columns out of the assessment", () => {
    // The exact shape a real row has: the six migration-001 columns are
    // NOT NULL DEFAULT 50, so a keeper's row carries 50s for attributes
    // their assessment form never showed. Reading them raw presented four
    // invented numbers to every AI feature.
    const gkRow = {
      pace: 62, shooting: 50, passing: 50, dribbling: 50, defending: 50, physical: 50,
      shot_stopping: 78, reflexes: 81, handling: 74, distribution: 66,
      positioning: 70, decision_making: 68, game_reading: 65,
      agility: 77, jumping: 72, strength: 64,
      composure: 69, leadership: 60, communication: 71,
    };
    const snap = buildAttributeSnapshot([gkRow], "gk");

    expect(snap.assessedKeys).toContain("shot_stopping");
    expect(snap.assessedKeys).toContain("reflexes");
    expect(snap.assessedKeys).toContain("pace"); // a keeper IS rated on pace
    expect(snap.assessedKeys).not.toContain("shooting");
    expect(snap.assessedKeys).not.toContain("defending");
    expect(snap.assessedKeys).not.toContain("physical");
  });

  it("never reports `physical`, which no position is assessed on", () => {
    for (const position of ["gk", "cb", "cm", "st", "lw", null]) {
      const snap = buildAttributeSnapshot([{ physical: 50, passing: 70 }], position);
      expect(snap.assessedKeys).not.toContain("physical");
    }
  });

  it("averages each attribute over the coaches who rated it, not over all rows", () => {
    // Two coaches on the same player (team_coaches, migration 019). Both
    // rated `passing`; only one rated `tackling`. Averaging `tackling` over
    // both rows would halve it, and a coach who left it NULL has said
    // nothing about it, not that it is bad.
    const snap = buildAttributeSnapshot(
      [{ passing: 60, tackling: 80 }, { passing: 70 }],
      "cm"
    );
    expect(snap.assessed.passing).toBe(65);
    expect(snap.assessed.tackling).toBe(80);
    expect(snap.coachCount).toBe(2);
  });

  it("reports nothing assessed when no coach has rated the player", () => {
    const snap = buildAttributeSnapshot([], "cm");
    expect(snap.assessedKeys).toHaveLength(0);
    expect(snap.overall).toBeNull();
    expect(describeAttributes(snap)).toBeNull();
  });

  it("treats a null row list as unassessed rather than throwing", () => {
    const snap = buildAttributeSnapshot(null, "cm");
    expect(snap.assessedKeys).toHaveLength(0);
    expect(snap.coachCount).toBe(0);
  });

  it("describes only real values, so a prompt cannot cite an invented one", () => {
    const described = describeAttributes(
      buildAttributeSnapshot([{ finishing: 80, physical: 50 }], "st")
    );
    expect(described).toBe("finishing 80");
    expect(described).not.toContain("physical");
  });
});
