import { buildWeekBrief } from "@/lib/week-brief";

const NOW = new Date("2026-10-05T08:00:00Z"); // a Monday
const S = (id: string, date: string) => ({ id, title: id, session_date: date });
const F = (id: string, date: string) => ({ id, opponent: id, fixture_date: date });

describe("buildWeekBrief", () => {
  it("keeps sessions in the next seven days, soonest first", () => {
    const b = buildWeekBrief(NOW, [
      S("fri", "2026-10-09T15:00:00Z"),
      S("wed", "2026-10-07T15:00:00Z"),
      S("last-week", "2026-10-01T15:00:00Z"),
      S("next-month", "2026-11-04T15:00:00Z"),
    ], []);
    expect(b.sessions.map((s) => s.id)).toEqual(["wed", "fri"]);
  });

  it("picks the next match inside the week and ignores one further away", () => {
    expect(buildWeekBrief(NOW, [], [F("a", "2026-10-11T08:00:00Z"), F("b", "2026-10-18T08:00:00Z")]).fixture?.id).toBe("a");
    expect(buildWeekBrief(NOW, [], [F("far", "2026-10-25T08:00:00Z")]).fixture).toBeNull();
  });

  it("flags a gap when a match is coming and no training comes before it", () => {
    expect(buildWeekBrief(NOW, [], [F("a", "2026-10-11T08:00:00Z")]).trainingGap).toBe(true);
    // training only AFTER the match does not help
    expect(buildWeekBrief(NOW, [S("late", "2026-10-12T08:00:00Z")], [F("a", "2026-10-11T08:00:00Z")]).trainingGap).toBe(true);
    expect(buildWeekBrief(NOW, [S("wed", "2026-10-07T15:00:00Z")], [F("a", "2026-10-11T08:00:00Z")]).trainingGap).toBe(false);
  });

  it("has no gap when there is no match", () => {
    expect(buildWeekBrief(NOW, [], []).trainingGap).toBe(false);
  });
});
