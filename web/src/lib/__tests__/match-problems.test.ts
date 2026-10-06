import { MATCH_PHASES } from "../match-phases";
import { MATCH_PROBLEMS, isOlderBand, presetKeyFor, problemsFor } from "../match-problems";

describe("MATCH_PROBLEMS", () => {
  it("has unique keys within 60 characters and text within 200", () => {
    const keys = MATCH_PROBLEMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of MATCH_PROBLEMS) {
      expect(p.key.length).toBeLessThanOrEqual(60);
      expect(p.text.length).toBeLessThanOrEqual(200);
    }
  });

  it("covers every phase with at least two problems for the younger band", () => {
    for (const phase of MATCH_PHASES) {
      expect(problemsFor(phase.id, "U11").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("never names a child", () => {
    for (const p of MATCH_PROBLEMS) expect(p.text).not.toMatch(/\b(he|she|his|her|him)\b/i);
  });
});

describe("isOlderBand", () => {
  it("is true from U13 up and false for U11 and below, unknown or missing", () => {
    expect(isOlderBand("U13")).toBe(true);
    expect(isOlderBand("U15")).toBe(true);
    expect(isOlderBand("U11")).toBe(false);
    expect(isOlderBand("U9")).toBe(false);
    expect(isOlderBand("Senior")).toBe(false);
    expect(isOlderBand(null)).toBe(false);
    expect(isOlderBand(undefined)).toBe(false);
  });
});

describe("problemsFor", () => {
  it("offers shared problems to everyone and the older ones from U13", () => {
    const young = problemsFor("in_possession", "U11").map((p) => p.key);
    const older = problemsFor("in_possession", "U13").map((p) => p.key);
    expect(young).toEqual(["ip-lose-playing-out", "ip-long-balls", "ip-no-width", "ip-no-shot"]);
    expect(older).toEqual([...young, "ip-deep-block"]);
  });

  it("offers only that phase's problems and none without a phase", () => {
    expect(problemsFor("set_pieces", "U15").every((p) => p.phase === "set_pieces")).toBe(true);
    expect(problemsFor(null, "U15")).toEqual([]);
  });
});

describe("presetKeyFor", () => {
  it("finds a preset by its exact wording, ignoring case and spacing", () => {
    expect(presetKeyFor("We play too many long balls and lose the ball.")).toBe("ip-long-balls");
    expect(presetKeyFor("  we PLAY too many  long balls and lose the ball. ")).toBe("ip-long-balls");
  });

  it("is null for the coach's own words, including an edited preset", () => {
    expect(presetKeyFor("We play too many long balls")).toBeNull();
    expect(presetKeyFor("")).toBeNull();
  });
});
