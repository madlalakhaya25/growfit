import { attendanceStreak, positionShort, squadStatus, type SquadStatusInput } from "@/lib/squad-status";
import type { AttendanceStatus } from "@/lib/attendance";

const base: SquadStatusInput = {
  availability: null, attendance: 90, belowThreshold: false, readinessLevel: "steady",
  docsOutstanding: 0, streak: 0, seasonMinutes: null, assessed: true, age: 12,
};

describe("squadStatus", () => {
  it("puts an injury first, with the coach's note", () => {
    expect(squadStatus({ ...base, availability: { status: "injured", note: "back in 2 weeks" }, docsOutstanding: 3 }))
      .toEqual({ text: "Injured · back in 2 weeks", tone: "clay" });
  });
  it("says low attendance as a nudge to check in", () => {
    expect(squadStatus({ ...base, attendance: 68, belowThreshold: true })).toEqual({ text: "68% this term · check in", tone: "clay" });
  });
  it("counts forms due", () => {
    expect(squadStatus({ ...base, docsOutstanding: 1 }).text).toBe("1 form due");
    expect(squadStatus({ ...base, docsOutstanding: 2 }).text).toBe("2 forms due");
  });
  it("celebrates a streak only once nothing needs a word", () => {
    expect(squadStatus({ ...base, streak: 6 })).toEqual({ text: "6 sessions in a row", tone: "sun" });
    expect(squadStatus({ ...base, streak: 6, docsOutstanding: 1 }).tone).toBe("clay");
    expect(squadStatus({ ...base, streak: 3 }).tone).toBe("neutral");
  });
  it("falls back to a plain fact", () => {
    expect(squadStatus({ ...base, seasonMinutes: 412 }).text).toBe("412′ this season");
    expect(squadStatus({ ...base, assessed: false }).text).toBe("Not assessed yet");
    expect(squadStatus(base).text).toBe("90% training");
    expect(squadStatus({ ...base, attendance: null, age: null }).text).toBe("New to the squad");
  });
});

describe("attendanceStreak", () => {
  const reg = (m: Record<string, AttendanceStatus>) => new Map(Object.entries(m));
  const marks = new Map([
    ["s4", reg({ a: "present", b: "absent" })],
    ["s3", new Map()],
    ["s2", reg({ a: "excused", b: "present" })],
    ["s1", reg({ a: "late", b: "present" })],
    ["s0", reg({ a: "absent", b: "present" })],
  ]);
  const order = ["s4", "s3", "s2", "s1", "s0"];
  it("counts back to the first miss, skipping excused and untaken registers", () => {
    expect(attendanceStreak("a", order, marks)).toBe(2);
  });
  it("is zero when the latest register has them absent", () => {
    expect(attendanceStreak("b", order, marks)).toBe(0);
  });
  it("stops at a register they are missing from", () => {
    expect(attendanceStreak("c", order, marks)).toBe(0);
  });
});

describe("positionShort", () => {
  it("uses the abbreviation, or the old label", () => {
    expect(positionShort("cb")).toBe("CB");
    expect(positionShort("defender")).toBe("Defender");
    expect(positionShort(null)).toBe("");
  });
});
