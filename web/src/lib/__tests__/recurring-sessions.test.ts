import { MAX_REPEATED_SESSIONS, weekdayOf, weeklyRepeatStarts, weeksAfter } from "@/lib/recurring-sessions";
import { academyLocalToIso } from "@/lib/time";

describe("weeklyRepeatStarts", () => {
  it("repeats on Wednesdays and Fridays at the same time of day", () => {
    // 14 Oct 2026 is a Wednesday.
    expect(weeklyRepeatStarts("2026-10-14T17:00", [3, 5], "2026-10-23")).toEqual([
      "2026-10-14T17:00",
      "2026-10-16T17:00",
      "2026-10-21T17:00",
      "2026-10-23T17:00",
    ]);
  });

  it("always keeps the first session, even on a weekday that isn't picked", () => {
    expect(weeklyRepeatStarts("2026-10-13T17:00", [3], "2026-10-21")).toEqual([
      "2026-10-13T17:00",
      "2026-10-14T17:00",
      "2026-10-21T17:00",
    ]);
  });

  it("returns only the first session when the end date is before it or no day is picked", () => {
    expect(weeklyRepeatStarts("2026-10-14T17:00", [3], "2026-10-01")).toEqual(["2026-10-14T17:00"]);
    expect(weeklyRepeatStarts("2026-10-14T17:00", [], "2026-12-01")).toEqual(["2026-10-14T17:00"]);
  });

  it("crosses month and year ends", () => {
    expect(weeklyRepeatStarts("2026-12-30T09:30", [3], "2027-01-13")).toEqual([
      "2026-12-30T09:30",
      "2027-01-06T09:30",
      "2027-01-13T09:30",
    ]);
  });

  it("caps a long range", () => {
    expect(weeklyRepeatStarts("2026-01-05T17:00", [0, 1, 2, 3, 4, 5, 6], "2027-01-01")).toHaveLength(MAX_REPEATED_SESSIONS);
  });

  it("ignores invalid input", () => {
    expect(weeklyRepeatStarts("not a date", [3], "2026-12-01")).toEqual([]);
    expect(weeklyRepeatStarts("2026-10-14T17:00", [3, 9, -1], "garbage")).toEqual(["2026-10-14T17:00"]);
  });
});

describe("weekdayOf and weeksAfter", () => {
  it("read the date part of a datetime-local value", () => {
    expect(weekdayOf("2026-10-14T23:30")).toBe(3);
    expect(weeksAfter("2026-10-14T23:30", 8)).toBe("2026-12-09");
    expect(weekdayOf("")).toBeNull();
  });
});

describe("academyLocalToIso", () => {
  it("reads a form value as South African time", () => {
    expect(academyLocalToIso("2026-10-15T17:00")).toBe("2026-10-15T15:00:00.000Z");
    expect(academyLocalToIso("2026-10-15T01:00:30")).toBe("2026-10-14T23:00:30.000Z");
  });

  it("leaves a value that already has an offset alone", () => {
    expect(academyLocalToIso("2026-10-15T17:00:00+02:00")).toBe("2026-10-15T17:00:00+02:00");
    expect(academyLocalToIso("2026-10-15T15:00:00.000Z")).toBe("2026-10-15T15:00:00.000Z");
  });
});
