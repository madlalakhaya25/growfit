import { addDays, buildWeekPlan, dayOf, matchDayLabel, mondayOf, parseDay, sessionLoad } from "../week-plan";

describe("calendar helpers", () => {
  it("finds the Monday of any day in the week", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(mondayOf("2026-10-01")).toBe("2026-09-28"); // across a month
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-10-05", -7)).toBe("2026-09-28");
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(parseDay("2026-10-05")).toBe("2026-10-05");
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("5 Oct")).toBeNull();
    expect(parseDay(undefined)).toBeNull();
  });

  it("puts a late-evening UTC instant on the next Durban day", () => {
    expect(dayOf("2026-10-06T23:00:00Z")).toBe("2026-10-07");
  });
});

describe("sessionLoad", () => {
  it("uses the recorded effort when there is one", () => {
    expect(sessionLoad({ session_type: "recovery", rpe: 9 })).toEqual({ load: 3, from: "recorded" });
    expect(sessionLoad({ session_type: "fitness", rpe: 3 })).toEqual({ load: 1, from: "recorded" });
    expect(sessionLoad({ session_type: "fitness", rpe: 5 })).toEqual({ load: 2, from: "recorded" });
  });

  it("falls back to what the session type implies", () => {
    expect(sessionLoad({ session_type: "fitness" })).toEqual({ load: 3, from: "planned" });
    expect(sessionLoad({ session_type: "recovery", rpe: null })).toEqual({ load: 1, from: "planned" });
    expect(sessionLoad({ session_type: "something-new" })).toEqual({ load: 2, from: "planned" });
  });
});

describe("matchDayLabel", () => {
  const sunday = ["2026-10-11"];
  it("counts down to the match and up from it", () => {
    expect(matchDayLabel("2026-10-11", sunday)).toBe("MD");
    expect(matchDayLabel("2026-10-09", sunday)).toBe("MD-2");
    expect(matchDayLabel("2026-10-07", sunday)).toBe("MD-4");
    expect(matchDayLabel("2026-10-12", sunday)).toBe("MD+1");
  });

  it("prefers the coming match over the last one", () => {
    expect(matchDayLabel("2026-10-12", ["2026-10-11", "2026-10-14"])).toBe("MD-2");
  });

  it("leaves days far from any match unlabelled", () => {
    expect(matchDayLabel("2026-10-05", sunday)).toBeNull();
    expect(matchDayLabel("2026-10-14", sunday)).toBeNull();
  });
});

describe("buildWeekPlan", () => {
  // The academy's real week: Wednesday and Friday training, Sunday match.
  const now = new Date("2026-10-07T08:00:00Z");
  const base = {
    start: "2026-10-05",
    now,
    sessions: [
      { id: "fri", title: "Pressing", session_date: "2026-10-09T15:30:00Z", session_type: "tactical" },
      { id: "wed", title: "Passing", session_date: "2026-10-07T15:30:00Z", session_type: "technical", rpe: 7 },
    ],
    fixtures: [
      { id: "m1", opponent: "Durban City", fixture_date: "2026-10-11T08:00:00Z", is_home: true, status: "upcoming" },
      { id: "x", opponent: "Called off", fixture_date: "2026-10-08T08:00:00Z", is_home: true, status: "cancelled" },
    ],
    plays: [
      { id: "p1", name: "Overlap", session_id: "fri", fixture_id: null },
      { id: "p2", name: "Corner", session_id: null, fixture_id: "m1" },
    ],
  };

  it("lays out Monday to Sunday with today, sessions, the match and attached plays", () => {
    const plan = buildWeekPlan(base);
    expect(plan.days.map((d) => d.date)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
    expect(plan.end).toBe("2026-10-11");
    expect(plan.days[2]).toMatchObject({ isToday: true, matchDay: "MD-4", load: 3 });
    expect(plan.days[2].sessions[0]).toMatchObject({ id: "wed", loadFrom: "recorded" });
    expect(plan.days[4].sessions[0].plays.map((p) => p.name)).toEqual(["Overlap"]);
    expect(plan.days[6]).toMatchObject({ matchDay: "MD", load: 3 });
    expect(plan.days[6].fixtures[0].plays.map((p) => p.name)).toEqual(["Corner"]);
  });

  it("leaves out a cancelled match", () => {
    const plan = buildWeekPlan(base);
    expect(plan.days[3].fixtures).toEqual([]);
    expect(plan.days[3].matchDay).toBe("MD-3");
  });

  it("warns about a hard session the day before the match", () => {
    const plan = buildWeekPlan({
      ...base,
      sessions: [{ id: "sat", title: "Fitness", session_date: "2026-10-10T08:00:00Z", session_type: "fitness" }],
    });
    expect(plan.warnings).toEqual([expect.stringMatching(/day before a match/)]);
  });

  it("warns when nothing is planned, and stays quiet for a sensible week", () => {
    expect(buildWeekPlan({ ...base, sessions: [] }).warnings).toEqual(["No training planned this week."]);
    expect(buildWeekPlan(base).warnings).toEqual([]);
  });
});
