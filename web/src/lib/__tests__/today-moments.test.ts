import { calendarDaysUntil, upcomingBirthdays, whenLabel } from "@/lib/today-moments";

// Sunday 26 Oct 2026, 07:20 in Durban (05:20 UTC).
const now = new Date("2026-10-26T05:20:00Z");

describe("whenLabel", () => {
  it("counts down on the day", () => {
    expect(whenLabel("2026-10-26T07:00:00Z", now)).toBe("In 1 h 40 min");
    expect(whenLabel("2026-10-26T05:45:00Z", now)).toBe("In 25 min");
    expect(whenLabel("2026-10-26T07:20:00Z", now)).toBe("In 2 h");
  });
  it("says it has started", () => {
    expect(whenLabel("2026-10-26T05:00:00Z", now)).toBe("On now");
    expect(whenLabel("2026-10-26T05:00:00Z", now, "Kicked off")).toBe("Kicked off");
  });
  it("names tomorrow and later days", () => {
    expect(whenLabel("2026-10-27T14:00:00Z", now)).toBe("Tomorrow");
    expect(whenLabel("2026-10-29T14:00:00Z", now)).toBe("Thursday");
  });
  it("uses academy time for the calendar day", () => {
    // 23:30 UTC on the 26th is already the 27th in Durban.
    expect(calendarDaysUntil("2026-10-26T23:30:00Z", now)).toBe(1);
  });
});

describe("upcomingBirthdays", () => {
  const p = (firstName: string, dateOfBirth: string | null) => ({ firstName, dateOfBirth, teamLabel: "U11" });
  it("finds this week's birthdays, soonest first, with the age they turn", () => {
    const out = upcomingBirthdays([p("Ayanda", "2015-10-30"), p("Sipho", "2014-10-26"), p("Lwazi", "2014-11-20"), p("Musa", null)], now);
    expect(out.map((b) => [b.firstName, b.turns, b.when])).toEqual([
      ["Sipho", 12, "today"],
      ["Ayanda", 11, "on Friday"],
    ]);
  });
  it("wraps into January", () => {
    const dec = new Date("2026-12-29T08:00:00Z");
    expect(upcomingBirthdays([p("Zola", "2014-01-02")], dec)[0]).toMatchObject({ turns: 13, inDays: 4 });
  });
});
