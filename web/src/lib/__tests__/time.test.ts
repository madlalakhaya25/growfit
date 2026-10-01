import {
  monthStartIso,
  formatInTimezone,
  formatDayMonth,
  formatTime,
  formatWeekdayDayMonth,
  formatDayMonthYear,
  currentHourInTimezone,
} from "@/lib/time";

// Africa/Johannesburg is UTC+2 with no daylight saving, so every case here
// picks a UTC instant deliberately close to a day boundary -- the exact
// case that silently breaks without an explicit timeZone.
describe("lib/time", () => {
  // 2026-09-25T22:15:00Z -> 2026-09-26T00:15 in Africa/Johannesburg.
  const lateUtc = "2026-09-25T22:15:00.000Z";

  it("formatInTimezone shifts into Africa/Johannesburg, not the runtime's own zone", () => {
    expect(formatInTimezone(lateUtc, { day: "numeric", month: "short" })).toBe("26 Sept");
  });

  it("formatDayMonth", () => {
    expect(formatDayMonth(lateUtc)).toBe("26 Sept");
    expect(formatDayMonth("2026-09-25T10:00:00.000Z")).toBe("25 Sept");
  });

  it("formatTime rolls over correctly across the UTC day boundary", () => {
    expect(formatTime(lateUtc)).toBe("00:15");
  });

  it("formatWeekdayDayMonth", () => {
    // 25 Sep 2026 is a Friday in UTC, but 00:15 SAST on the 26th is a Saturday.
    expect(formatWeekdayDayMonth(lateUtc)).toBe("Sat, 26 Sept");
  });

  it("formatDayMonthYear", () => {
    expect(formatDayMonthYear(lateUtc)).toBe("26 Sept 2026");
  });

  it("accepts a Date instance as well as an ISO string", () => {
    expect(formatDayMonth(new Date(lateUtc))).toBe("26 Sept");
  });

  it("currentHourInTimezone reads the SAST hour, not the given Date's own getHours()", () => {
    expect(currentHourInTimezone(new Date(lateUtc))).toBe(0);
  });

  it("currentHourInTimezone handles a mid-day instant with no boundary crossing", () => {
    // 2026-09-25T09:00:00Z -> 11:00 SAST.
    expect(currentHourInTimezone(new Date("2026-09-25T09:00:00.000Z"))).toBe(11);
  });
});

describe("monthStartIso", () => {
  it("is midnight on the 1st in South Africa (+02:00), i.e. 22:00 UTC the evening before", () => {
    expect(monthStartIso(new Date("2026-10-15T10:00:00Z"))).toBe("2026-09-30T22:00:00.000Z");
  });

  it("uses the SOUTH AFRICAN month, not the host's: 23:30 UTC on 31 Oct is already 1 Nov in Durban", () => {
    expect(monthStartIso(new Date("2026-10-31T23:30:00Z"))).toBe("2026-10-31T22:00:00.000Z");
    expect(monthStartIso(new Date("2026-10-31T21:30:00Z"))).toBe("2026-09-30T22:00:00.000Z");
  });

  it("handles the year boundary", () => {
    expect(monthStartIso(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31T22:00:00.000Z");
  });
});
