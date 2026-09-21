import {
  ATTENDANCE_STATUSES,
  WELFARE_ATTENDANCE_THRESHOLD,
  countsAsAttended,
  countsTowardTotal,
  isAttendanceStatus,
  isLegacyAttendanceConstraint,
  summariseAttendance,
  type AttendanceStatus,
} from "../attendance";

describe("attendance vocabulary", () => {
  it("matches the P/A/L/E policy the academy adopted", () => {
    expect([...ATTENDANCE_STATUSES].sort()).toEqual(
      ["absent", "excused", "late", "present"].sort()
    );
  });

  it("rejects migration 005's RSVP vocabulary", () => {
    // These are the values the pre-036 CHECK constraint allowed, and what
    // squad-context.ts and the coach squad page were both counting. Neither
    // is a valid mark, and a row still carrying one must not be silently
    // treated as attendance.
    expect(isAttendanceStatus("attending")).toBe(false);
    expect(isAttendanceStatus("unavailable")).toBe(false);
  });

  it("recognises the real statuses", () => {
    for (const status of ATTENDANCE_STATUSES) {
      expect(isAttendanceStatus(status)).toBe(true);
    }
  });
});

describe("the policy rules", () => {
  it("counts late as having turned up", () => {
    // A child who arrives late because of a taxi still came to training. The
    // threshold exists to trigger a welfare conversation, and this is not
    // the thing it is looking for.
    expect(countsAsAttended("late")).toBe(true);
    expect(countsAsAttended("present")).toBe(true);
    expect(countsAsAttended("absent")).toBe(false);
  });

  it("leaves excused out of the total entirely", () => {
    // Not counted as attended, and not counted against them either —
    // otherwise the more honestly a parent communicates, the worse their
    // child's record looks.
    expect(countsTowardTotal("excused")).toBe(false);
    expect(countsTowardTotal("absent")).toBe(true);
    expect(countsTowardTotal("late")).toBe(true);
  });
});

describe("summariseAttendance", () => {
  const marks = (...s: AttendanceStatus[]) => summariseAttendance(s);

  it("reports nothing to judge on when no marks exist", () => {
    const summary = marks();
    expect(summary.pct).toBeNull();
    expect(summary.belowThreshold).toBe(false);
  });

  it("keeps an unmarked player off the welfare list", () => {
    // The old maths divided by every session in the window, so a player with
    // no marks read as 0% and was flagged. Combined with the constraint bug
    // that made marking impossible, that meant the welfare page listed the
    // entire academy.
    expect(marks().belowThreshold).toBe(false);
  });

  it("counts late toward the percentage", () => {
    const summary = marks("present", "present", "late", "absent");
    expect(summary.attended).toBe(3);
    expect(summary.assessed).toBe(4);
    expect(summary.pct).toBe(75);
  });

  it("excludes excused from the denominator rather than failing the player", () => {
    // Three sessions: attended two, excused from one. Counting excused as an
    // absence gives 67% and a welfare flag; excluding it gives 100%.
    const summary = marks("present", "present", "excused");
    expect(summary.assessed).toBe(2);
    expect(summary.attended).toBe(2);
    expect(summary.pct).toBe(100);
    expect(summary.belowThreshold).toBe(false);
  });

  it("returns null rather than 0% when every mark is excused", () => {
    const summary = marks("excused", "excused");
    expect(summary.pct).toBeNull();
    expect(summary.belowThreshold).toBe(false);
  });

  it("flags exactly at the policy threshold boundary", () => {
    // 75% is not below 75%.
    expect(marks("present", "present", "present", "absent").belowThreshold).toBe(false);
    // 3 of 5 = 60%.
    expect(
      marks("present", "present", "present", "absent", "absent").belowThreshold
    ).toBe(true);
  });

  it("uses the threshold constant rather than a hardcoded 0.75", () => {
    expect(WELFARE_ATTENDANCE_THRESHOLD).toBe(0.75);
  });
});

describe("isLegacyAttendanceConstraint", () => {
  it("recognises the pre-036 check violation", () => {
    expect(isLegacyAttendanceConstraint({ code: "23514" })).toBe(true);
  });

  it("does not swallow unrelated errors", () => {
    expect(isLegacyAttendanceConstraint({ code: "42501" })).toBe(false);
    expect(isLegacyAttendanceConstraint(null)).toBe(false);
    expect(isLegacyAttendanceConstraint(undefined)).toBe(false);
  });
});
