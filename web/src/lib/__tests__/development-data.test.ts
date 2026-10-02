import {
  MILESTONES_LOAD_ERROR,
  MILESTONES_NO_ACADEMY,
  buildDevelopmentSnapshot,
  groupCompletionsBySeason,
  loadDevelopmentSnapshot,
  templatesForAgeGroups,
  type MilestoneCompletion,
  type MilestoneTemplate,
} from "../development-data";

jest.mock("../report-error", () => ({ reportError: jest.fn() }));

const NOW = new Date("2026-10-10T10:00:00Z");
const c = (templateId: string, season: string, completedAt: string | null, extra: Partial<MilestoneCompletion> = {}): MilestoneCompletion => ({
  templateId, season, completedAt, note: null, completedByName: null, ...extra,
});
const tpl = (id: string): MilestoneTemplate => ({
  id, title: id, description: null, category: "technical", position: null, age_group: null, sort_order: 0,
});

describe("groupCompletionsBySeason", () => {
  it("puts the newest season first and the newest completion first inside it", () => {
    const out = groupCompletionsBySeason(
      [
        c("a", "2025", "2025-03-01T10:00:00Z"),
        c("b", "2026", "2026-02-01T10:00:00Z"),
        c("c", "2026", "2026-09-01T10:00:00Z"),
        c("d", "2024", "2024-05-01T10:00:00Z"),
      ],
      NOW
    );
    expect(out.map((s) => s.season)).toEqual(["2026", "2025", "2024"]);
    expect(out[0].completions.map((x) => x.templateId)).toEqual(["c", "b"]);
  });

  it("always includes the current season, even with nothing in it", () => {
    const out = groupCompletionsBySeason([c("a", "2025", "2025-03-01T10:00:00Z")], NOW);
    expect(out.map((s) => s.season)).toEqual(["2026", "2025"]);
    expect(out[0].completions).toEqual([]);
  });

  it("with no completions at all returns just the empty current season", () => {
    expect(groupCompletionsBySeason([], NOW)).toEqual([{ season: "2026", completions: [] }]);
  });

  it("sorts seasons numerically, not lexically", () => {
    const out = groupCompletionsBySeason([c("a", "999", "2000-01-01T00:00:00Z"), c("b", "2025", "2025-01-01T00:00:00Z")], NOW);
    expect(out.map((s) => s.season)).toEqual(["2026", "2025", "999"]);
  });

  it("sorts a missing timestamp last and is stable whatever order the rows arrive in", () => {
    const rows = [c("z", "2026", null), c("a", "2026", "2026-05-01T00:00:00Z"), c("m", "2026", "2026-05-01T00:00:00Z")];
    const forward = groupCompletionsBySeason(rows, NOW)[0].completions.map((x) => x.templateId);
    const reverse = groupCompletionsBySeason([...rows].reverse(), NOW)[0].completions.map((x) => x.templateId);
    expect(forward).toEqual(["a", "m", "z"]);
    expect(reverse).toEqual(forward);
  });

  it("does not mutate its input", () => {
    const rows = [c("b", "2026", "2026-01-01T00:00:00Z"), c("a", "2026", "2026-06-01T00:00:00Z")];
    const copy = [...rows];
    groupCompletionsBySeason(rows, NOW);
    expect(rows).toEqual(copy);
  });
});

describe("buildDevelopmentSnapshot", () => {
  it("only this season's completions count as done, with their notes", () => {
    const s = buildDevelopmentSnapshot({
      templates: [tpl("a"), tpl("b")],
      completions: [c("a", "2026", "2026-02-01T00:00:00Z", { note: "Nailed it" }), c("b", "2025", "2025-02-01T00:00:00Z")],
      now: NOW,
    });
    expect([...s.completedThisSeason]).toEqual(["a"]);
    expect(s.currentNotes).toEqual({ a: "Nailed it" });
    expect(s.currentSeason).toBe("2026");
    expect(s.loadError).toBeNull();
  });
});

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };
/** Chainable stand-in resolving per table; see ai-artefacts.test.ts for why this isn't a mock of app logic. */
function stub(byTable: Record<string, Result>) {
  return {
    from(table: string) {
      const res = { data: null, error: null, ...(byTable[table] ?? {}) };
      const self: unknown = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(res);
          return () => self;
        },
      });
      return self;
    },
  } as never;
}

describe("loadDevelopmentSnapshot", () => {
  it("a failed query is reported as an error, never as an empty pathway", async () => {
    const s = await loadDevelopmentSnapshot(
      stub({ development_milestone_templates: { error: { code: "42501", message: "denied" } }, player_milestone_completions: { data: [] } }),
      { playerId: "p", academyId: "ac", position: null, now: NOW }
    );
    expect(s.loadError).toBe(MILESTONES_LOAD_ERROR);
    expect(s.templates).toEqual([]);
  });

  it("a failed completions query is also an error", async () => {
    const s = await loadDevelopmentSnapshot(
      stub({ development_milestone_templates: { data: [tpl("a")] }, player_milestone_completions: { error: { message: "boom" } } }),
      { playerId: "p", academyId: "ac", position: null, now: NOW }
    );
    expect(s.loadError).toBe(MILESTONES_LOAD_ERROR);
  });

  it("a missing academy is its own message, distinct from 'no milestones yet'", async () => {
    const s = await loadDevelopmentSnapshot(stub({}), { playerId: "p", academyId: null, position: null, now: NOW });
    expect(s.loadError).toBe(MILESTONES_NO_ACADEMY);
    expect(s.loadError).not.toBe(MILESTONES_LOAD_ERROR);
  });

  it("a genuinely empty pathway has no error", async () => {
    const s = await loadDevelopmentSnapshot(
      stub({ development_milestone_templates: { data: [] }, player_milestone_completions: { data: [] } }),
      { playerId: "p", academyId: "ac", position: null, now: NOW }
    );
    expect(s.loadError).toBeNull();
    expect(s.templates).toEqual([]);
  });

  it("resolves coach names only when asked, and leaves null otherwise", async () => {
    const tables = {
      development_milestone_templates: { data: [tpl("a")] },
      player_milestone_completions: {
        data: [{ template_id: "a", season: "2026", completed_at: "2026-03-01T00:00:00Z", completed_by: "coach-1", note: null }],
      },
      profiles: { data: [{ id: "coach-1", full_name: "Sphe Mlotshwa" }] },
    };
    const withNames = await loadDevelopmentSnapshot(stub(tables), { playerId: "p", academyId: "ac", position: null, resolveCompletedBy: true, now: NOW });
    expect(withNames.seasons[0].completions[0].completedByName).toBe("Sphe Mlotshwa");
    const without = await loadDevelopmentSnapshot(stub(tables), { playerId: "p", academyId: "ac", position: null, now: NOW });
    expect(without.seasons[0].completions[0].completedByName).toBeNull();
  });

  it("a failed name lookup degrades to a null name rather than failing the load", async () => {
    const s = await loadDevelopmentSnapshot(
      stub({
        development_milestone_templates: { data: [tpl("a")] },
        player_milestone_completions: {
          data: [{ template_id: "a", season: "2026", completed_at: "2026-03-01T00:00:00Z", completed_by: "coach-1", note: null }],
        },
        profiles: { error: { message: "nope" } },
      }),
      { playerId: "p", academyId: "ac", position: null, resolveCompletedBy: true, now: NOW }
    );
    expect(s.loadError).toBeNull();
    expect(s.seasons[0].completions[0].completedByName).toBeNull();
  });
});

describe("templatesForAgeGroups", () => {
  const aged = (id: string, age_group: string | null): MilestoneTemplate => ({ ...tpl(id), age_group });
  const all = [aged("any", null), aged("u11", "U11"), aged("u13", "U13"), aged("u15", "U15")];

  it("keeps the player's own age group and the all-ages milestones", () => {
    expect(templatesForAgeGroups(all, ["U11"], new Set()).map((t) => t.id)).toEqual(["any", "u11"]);
  });

  it("matches age groups regardless of case or stray spaces", () => {
    expect(templatesForAgeGroups(all, [" u13 "], new Set()).map((t) => t.id)).toEqual(["any", "u13"]);
  });

  it("keeps a milestone the player already completed, so moving up an age group keeps their history", () => {
    expect(templatesForAgeGroups(all, ["U13"], new Set(["u11"])).map((t) => t.id)).toEqual(["any", "u11", "u13"]);
  });

  it("hides nothing when the player's age group isn't known", () => {
    expect(templatesForAgeGroups(all, [], new Set())).toEqual(all);
  });
});

describe("loadDevelopmentSnapshot age groups", () => {
  const tables = (teams: Result) => ({
    development_milestone_templates: { data: [
      { ...tpl("any"), age_group: null }, { ...tpl("u11"), age_group: "U11" }, { ...tpl("u15"), age_group: "U15" },
    ] },
    player_milestone_completions: { data: [] },
    team_members: teams,
  });

  it("shows an U11 player only U11 and all-ages milestones", async () => {
    const s = await loadDevelopmentSnapshot(
      stub(tables({ data: [{ teams: { age_group: "U11" } }] })),
      { playerId: "p", academyId: "ac", position: null, now: NOW }
    );
    expect(s.templates.map((t) => t.id)).toEqual(["any", "u11"]);
  });

  it("shows every milestone, without failing, when the team lookup fails", async () => {
    const s = await loadDevelopmentSnapshot(
      stub(tables({ error: { message: "denied" } })),
      { playerId: "p", academyId: "ac", position: null, now: NOW }
    );
    expect(s.loadError).toBeNull();
    expect(s.templates.map((t) => t.id)).toEqual(["any", "u11", "u15"]);
  });
});
