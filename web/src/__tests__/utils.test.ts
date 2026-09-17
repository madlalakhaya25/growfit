import { matchRatingAverage } from "@/lib/player";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("drops falsy values", () => {
    expect(cn("foo", false, null, undefined, "bar")).toBe("foo bar");
  });

  it("handles conditional objects", () => {
    expect(cn({ foo: true, bar: false })).toBe("foo");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    // tailwind-merge resolves conflicts: px-2 overrides px-4
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("handles text colour conflicts", () => {
    expect(cn("text-red-500", "text-green-500")).toBe("text-green-500");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });
});

describe("matchRatingAverage", () => {
  it("scales a 1-5 mean to the 0-100 the rating ring uses", () => {
    expect(matchRatingAverage([5, 5, 5])).toBe(100);
    expect(matchRatingAverage([3])).toBe(60);
    expect(matchRatingAverage([4, 5])).toBe(90);
  });

  it("returns 0 rather than NaN when a player has no ratings", () => {
    expect(matchRatingAverage([])).toBe(0);
  });
});
