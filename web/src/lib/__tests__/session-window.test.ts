import { isHappeningNow, sessionWindowStart, SESSION_WINDOW_MS } from "@/lib/session-window";

const start = new Date("2026-10-07T16:00:00Z").getTime();
const iso = new Date(start).toISOString();

describe("isHappeningNow", () => {
  it("is false before the start time", () => {
    expect(isHappeningNow(iso, start - 1)).toBe(false);
  });
  it("is true from the start until the window closes", () => {
    expect(isHappeningNow(iso, start)).toBe(true);
    expect(isHappeningNow(iso, start + SESSION_WINDOW_MS - 1)).toBe(true);
  });
  it("is false once the window has closed", () => {
    expect(isHappeningNow(iso, start + SESSION_WINDOW_MS)).toBe(false);
  });
});

describe("sessionWindowStart", () => {
  it("is the earliest start that still counts as current", () => {
    const now = start + 90 * 60 * 1000;
    const from = new Date(sessionWindowStart(now)).getTime();
    expect(from).toBeLessThanOrEqual(start);
    expect(isHappeningNow(iso, now)).toBe(true);
    expect(new Date(sessionWindowStart(start + SESSION_WINDOW_MS + 1)).getTime()).toBeGreaterThan(start);
  });
});
