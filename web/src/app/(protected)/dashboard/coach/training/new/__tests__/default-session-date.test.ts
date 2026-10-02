jest.mock("@/app/actions/session-generator", () => ({ generateSessionPlan: jest.fn() }));
jest.mock("@/app/actions/training", () => ({ createTrainingSessionWithDrills: jest.fn() }));

import { defaultSessionDate } from "../new-session-form";

describe("defaultSessionDate", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is two days out in the coach's own timezone, not UTC", () => {
    // SAST is UTC+2, which getTimezoneOffset reports as -120.
    jest.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-120);
    // 10:00 UTC is 12:00 in SAST.
    expect(defaultSessionDate(new Date("2026-10-02T10:00:00Z"))).toBe("2026-10-04T12:00");
  });
});
