import { ageFromAgeGroup, cleanRewrite, missingNumbers, rewriteBrief, rewriteSubjectId } from "../age-rewrite";

describe("ageFromAgeGroup", () => {
  it("reads the age out of a group label or a number, clamped to a sane range", () => {
    expect(ageFromAgeGroup("U11")).toBe(11);
    expect(ageFromAgeGroup("u13s")).toBe(13);
    expect(ageFromAgeGroup(9)).toBe(9);
    expect(ageFromAgeGroup("U3")).toBe(6);
    expect(ageFromAgeGroup("U40")).toBe(18);
  });
  it("is null with nothing to go on, rather than a guessed reading level", () => {
    expect(ageFromAgeGroup(null)).toBeNull();
    expect(ageFromAgeGroup("Senior")).toBeNull();
    expect(ageFromAgeGroup("")).toBeNull();
  });
});

describe("rewriteSubjectId", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
  it("is a UUID, stable for the same note and age", () => {
    const id = rewriteSubjectId("Training is at 17:00", 11);
    expect(id).toMatch(UUID);
    expect(id).toBe(rewriteSubjectId("  Training is at 17:00  ", 11));
  });
  it("changes with the note and with the age", () => {
    const base = rewriteSubjectId("Training is at 17:00", 11);
    expect(rewriteSubjectId("Training is at 17:30", 11)).not.toBe(base);
    expect(rewriteSubjectId("Training is at 17:00", 12)).not.toBe(base);
  });
  it("is what gets fingerprinted: the brief carries the age and the note", () => {
    expect(rewriteBrief(" hi ", 9)).toBe("AGE: 9\nNOTE:\nhi");
  });
});

describe("missingNumbers", () => {
  it("is empty when every figure survives", () => {
    expect(missingNumbers("Be there at 17:00 on 12 Oct, bring R50", "Come at 17:00 on 12 Oct. Bring R50.")).toEqual([]);
  });
  it("lists a time, date or amount the rewrite dropped or changed", () => {
    expect(missingNumbers("Be there at 17:00 on 12 Oct, bring R50", "Come after school on 12 Oct. Bring R60.")).toEqual(["17:00", "50"]);
  });
  it("says nothing when the note has no figures", () => {
    expect(missingNumbers("Great effort today", "Well done today")).toEqual([]);
  });
});

describe("cleanRewrite", () => {
  it("strips asterisks and wrapping quotes", () => {
    expect(cleanRewrite('"**Well** done!"')).toBe("Well done!");
    expect(cleanRewrite("  plain  ")).toBe("plain");
  });
});
