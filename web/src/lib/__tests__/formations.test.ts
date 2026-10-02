import { firstFormationOfSize, formatSizeForAge, FORMATIONS } from "@/lib/formations";

describe("formatSizeForAge", () => {
  it.each([
    ["U7", 5], ["U8", 5], ["U9", 7], ["U10", 7], ["U11", 9], ["U12", 9], ["U13", 11], ["U15", 11], ["u11", 9],
  ])("%s plays %i-a-side", (age, size) => {
    expect(formatSizeForAge(age)).toBe(size);
  });

  it("falls back to eleven-a-side when the age group is missing or unrecognised", () => {
    expect(formatSizeForAge(null)).toBe(11);
    expect(formatSizeForAge(undefined)).toBe(11);
    expect(formatSizeForAge("Open")).toBe(11);
    expect(formatSizeForAge("")).toBe(11);
  });
});

describe("firstFormationOfSize", () => {
  it("returns a preset of the asked format", () => {
    for (const size of [5, 7, 9, 11] as const) {
      expect(firstFormationOfSize(size).size).toBe(size);
      expect(FORMATIONS).toContain(firstFormationOfSize(size));
    }
  });
});
