import { isFixturePast } from "@/lib/fixtures";

describe("isFixturePast", () => {
  const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  it("keeps a future upcoming fixture as upcoming", () => {
    expect(isFixturePast({ status: "upcoming", fixture_date: hoursFromNow(2) })).toBe(false);
  });

  it("moves an upcoming fixture to past once kickoff has elapsed, even if unlogged", () => {
    expect(isFixturePast({ status: "upcoming", fixture_date: hoursFromNow(-2) })).toBe(true);
  });

  it("treats a completed fixture as past regardless of date", () => {
    expect(isFixturePast({ status: "completed", fixture_date: hoursFromNow(5) })).toBe(true);
  });

  it("treats a cancelled fixture as past regardless of date", () => {
    expect(isFixturePast({ status: "cancelled", fixture_date: hoursFromNow(-5) })).toBe(true);
  });

  it("keeps a postponed fixture as upcoming even once its stale date has elapsed", () => {
    expect(isFixturePast({ status: "postponed", fixture_date: hoursFromNow(-100) })).toBe(false);
  });
});
