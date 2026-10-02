import { selfToBand, gapBetween, gapPrompt, isSelfRating, usesFaces, SELF_RATING_LABELS } from "@/lib/self-assessment";

describe("selfToBand", () => {
  it("maps 1-5 onto the four bands", () => {
    expect([1, 2, 3, 4, 5].map((r) => selfToBand(r as 1 | 2 | 3 | 4 | 5))).toEqual([1, 2, 3, 3, 4]);
  });
});

describe("gap", () => {
  it("agrees when the mapped band matches", () => {
    expect(gapBetween(3, 3)).toBe("match");
    expect(gapBetween(4, 3)).toBe("match");
  });
  it("says which way the difference goes", () => {
    expect(gapBetween(5, 2)).toBe("child-higher");
    expect(gapBetween(1, 3)).toBe("child-lower");
  });
  it("gives the coach a question only when they differ, and never a score", () => {
    expect(gapPrompt("Technical", 3, 3)).toBeNull();
    const up = gapPrompt("Technical", 5, 2) as string;
    const down = gapPrompt("Mental", 1, 3) as string;
    expect(up).toMatch(/Technical: they feel really good, you see Developing\. Ask what they notice/);
    expect(down).toMatch(/Mental: they feel just starting, you see Secure\. Ask what is holding/);
    expect(up + down).not.toMatch(/score|rank|wrong|right/i);
    expect(SELF_RATING_LABELS[5]).toBe("Really good");
  });
});

describe("isSelfRating and usesFaces", () => {
  it("accepts 1-5 only", () => {
    expect([0, 1, 5, 6, "3", null].map(isSelfRating)).toEqual([false, true, true, false, false, false]);
  });
  it("uses faces for U12 and below", () => {
    expect(usesFaces("U11")).toBe(true);
    expect(usesFaces("U12")).toBe(true);
    expect(usesFaces("U13")).toBe(false);
    expect(usesFaces(null)).toBe(false);
  });
});
