import { buildDevelopmentBrief, bucketedAttendanceStart, ageFromDob, type BriefInput, type PreviousPlanContext } from "../development-brief";
import { fingerprintBrief } from "../ai-artefacts";
import type { DevelopmentPlanStructured } from "../development-plan-schema";

const input: BriefInput = {
  player: { fullName: "Anelisa Ngidi", position: "CM", age: 12 },
  attributes: [
    { label: "Passing", value: 72 },
    { label: "Stamina", value: 72 },
    { label: "Finishing", value: 55 },
    { label: "Composure", value: 80 },
  ],
  ratings: [
    { rating: 4, opponent: "Umlazi", createdAt: "2026-09-20T10:00:00Z" },
    { rating: 3, opponent: "Chatsworth", createdAt: "2026-09-13T10:00:00Z" },
    { rating: 3, opponent: "Chatsworth", createdAt: "2026-09-13T10:00:00Z" },
    { rating: 5, opponent: null, createdAt: "2026-09-06T10:00:00Z" },
  ],
  completed: [
    { title: "Captain a warm-up", category: "leadership" },
    { title: "Pass with either foot", category: "technical" },
  ],
  open: [
    { id: "id-3", title: "Third", category: "tactical", sortOrder: 2 },
    { id: "id-1", title: "First", category: "technical", sortOrder: 1 },
    { id: "id-2", title: "Second", category: "technical", sortOrder: 1 },
  ],
  attendance: { attended: 14, assessed: 20, pct: 70 },
  attendanceSince: "2026-07-01",
};

const shuffle = <T,>(xs: T[]): T[] => [...xs].reverse();
const shuffled = (i: BriefInput): BriefInput => ({
  ...i,
  attributes: shuffle(i.attributes),
  ratings: shuffle(i.ratings),
  completed: shuffle(i.completed),
  open: shuffle(i.open),
});

describe("determinism — the property the cache depends on", () => {
  it("the same brief built from shuffled arrays has ONE fingerprint", () => {
    const a = buildDevelopmentBrief(input, null).worldBrief;
    const b = buildDevelopmentBrief(shuffled(input), null).worldBrief;
    expect(b).toBe(a);
    expect(fingerprintBrief(b)).toBe(fingerprintBrief(a));
  });

  it("is stable across repeated builds", () => {
    expect(buildDevelopmentBrief(input, null).worldBrief).toBe(buildDevelopmentBrief(input, null).worldBrief);
  });

  it("breaks ties deterministically (equal values, equal dates, equal sort order)", () => {
    const b = buildDevelopmentBrief(input, null).worldBrief;
    expect(b.indexOf("Passing 72")).toBeLessThan(b.indexOf("Stamina 72")); // label order on a tie
    expect(b.indexOf("[id-1]")).toBeLessThan(b.indexOf("[id-2]")); // title order on equal sortOrder
  });

  it("contains no timestamps or other wall-clock text", () => {
    const b = buildDevelopmentBrief(input, null).worldBrief;
    expect(b).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
  });

  it("a real change in the data DOES change the fingerprint", () => {
    const changed = { ...input, completed: [...input.completed, { title: "New one", category: "mental" as const }] };
    expect(fingerprintBrief(buildDevelopmentBrief(changed, null).worldBrief)).not.toBe(
      fingerprintBrief(buildDevelopmentBrief(input, null).worldBrief)
    );
  });

  it("does not mutate its input", () => {
    const copy = JSON.parse(JSON.stringify(input));
    buildDevelopmentBrief(input, null);
    expect(input).toEqual(copy);
  });
});

const plan: DevelopmentPlanStructured = {
  playerSummary: "A composed midfielder.",
  focusAreas: [{ category: "technical", area: "First touch", why: "To keep the ball moving." }],
  actions: [{ what: "Wall passes", how: "50 a session", timesPerWeek: 3, measure: "40 clean", milestoneTemplateId: null }],
  reviewDate: "2026-10-30",
  previous: { verdict: "no_previous_plan", evidence: "", carriedForward: [] },
  coachNote: "Watch confidence.",
  playerNote: "Keep going.",
};
const previous: PreviousPlanContext = {
  createdAt: "2026-09-02T08:00:00Z",
  structured: plan,
  newCompletions: [{ title: "Pass with either foot", category: "technical" }],
  newRatings: [{ rating: 4, opponent: "Umlazi" }],
};

describe("the previous plan lives OUTSIDE the fingerprinted part", () => {
  it("worldBrief is identical with or without a previous plan", () => {
    expect(buildDevelopmentBrief(input, previous).worldBrief).toBe(buildDevelopmentBrief(input, null).worldBrief);
  });

  it("so generating a plan does not change the key the next call computes (the cache can hit)", () => {
    const beforeFirstPlan = fingerprintBrief(buildDevelopmentBrief(input, null).worldBrief);
    const afterFirstPlan = fingerprintBrief(buildDevelopmentBrief(input, previous).worldBrief);
    expect(afterFirstPlan).toBe(beforeFirstPlan);
  });

  it("the model still sees the previous plan and the pre-computed facts", () => {
    const { fullBrief } = buildDevelopmentBrief(input, previous);
    expect(fullBrief).toContain("PREVIOUS PLAN (written 2026-09-02)");
    expect(fullBrief).toContain("Milestones completed since: Technical: Pass with either foot");
    expect(fullBrief).toContain("Ratings since: 4/5 vs Umlazi");
    expect(fullBrief).toContain("Focus, Technical: First touch");
  });

  it("with no previous plan the full brief IS the world brief", () => {
    const r = buildDevelopmentBrief(input, null);
    expect(r.fullBrief).toBe(r.worldBrief);
    expect(r.fullBrief).not.toContain("PREVIOUS PLAN");
  });

  it("the 'since' facts are order-independent too", () => {
    const a = buildDevelopmentBrief(input, { ...previous, newRatings: [{ rating: 4, opponent: "Umlazi" }, { rating: 2, opponent: "Chatsworth" }] });
    const b = buildDevelopmentBrief(input, { ...previous, newRatings: [{ rating: 2, opponent: "Chatsworth" }, { rating: 4, opponent: "Umlazi" }] });
    expect(a.fullBrief).toBe(b.fullBrief);
  });
});

describe("the brief's content", () => {
  it("never invents data: unassessed and empty states say so", () => {
    const b = buildDevelopmentBrief(
      { ...input, attributes: [], ratings: [], completed: [], open: [], attendance: null },
      null
    ).worldBrief;
    expect(b).toContain("none assessed yet");
    expect(b).toContain("no recent ratings");
    expect(b).toContain("none yet");
    expect(b).toContain("none open");
    expect(b).toContain("No training attendance recorded since 2026-07-01");
  });

  it("caps open milestones and ratings", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `m${String(i).padStart(2, "0")}`, title: `T${i}`, category: "technical" as const, sortOrder: i }));
    const b = buildDevelopmentBrief({ ...input, open: many }, null).worldBrief;
    expect(b.match(/- \[m/g)).toHaveLength(6);
  });

  it("includes only what is needed: no id number, contact or medical fields are even in the input type", () => {
    const b = buildDevelopmentBrief(input, null).fullBrief.toLowerCase();
    for (const word of ["id number", "phone", "address", "allerg", "medical"]) expect(b).not.toContain(word);
  });
});

describe("bucketedAttendanceStart", () => {
  it("is constant for a whole calendar month, so the fingerprint doesn't thrash daily", () => {
    const days = ["2026-10-01", "2026-10-09", "2026-10-17", "2026-10-31"].map((d) => bucketedAttendanceStart(new Date(`${d}T12:00:00Z`)));
    expect(new Set(days).size).toBe(1);
  });
  it("moves when the month turns over, and is always a first of the month", () => {
    const oct = bucketedAttendanceStart(new Date("2026-10-31T12:00:00Z"));
    const nov = bucketedAttendanceStart(new Date("2026-11-01T12:00:00Z"));
    expect(oct).toMatch(/-01$/);
    expect(nov).toMatch(/-01$/);
    expect(nov > oct).toBe(true);
  });
  it("covers at least the 90-day policy window on EVERY day of a year, and is constant within each month", () => {
    const perMonth = new Map<string, Set<string>>();
    for (let d = 0; d < 366; d++) {
      const now = new Date(Date.UTC(2026, 0, 1 + d, 12));
      const start = bucketedAttendanceStart(now);
      expect((now.getTime() - Date.parse(`${start}T00:00:00Z`)) / 86_400_000).toBeGreaterThanOrEqual(90);
      // ...including the first instant of the month, where the window is narrowest
      const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
      expect((monthStart - Date.parse(`${start}T00:00:00Z`)) / 86_400_000).toBeGreaterThanOrEqual(90);
      const month = now.toISOString().slice(0, 7);
      perMonth.set(month, (perMonth.get(month) ?? new Set()).add(start));
    }
    for (const starts of perMonth.values()) expect(starts.size).toBe(1);
  });
});

describe("ageFromDob", () => {
  it("computes whole years and tolerates bad input", () => {
    expect(ageFromDob("2014-01-01", new Date("2026-10-01T00:00:00Z"))).toBe(12);
    expect(ageFromDob(null, new Date())).toBeNull();
    expect(ageFromDob("garbage", new Date())).toBeNull();
  });
});
