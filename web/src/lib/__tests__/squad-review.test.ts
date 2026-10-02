import { reviewProgress, nextIncomplete, clampIndex } from "@/lib/squad-review";

describe("reviewProgress", () => {
  it("counts bands done, bands owed and children finished", () => {
    expect(reviewProgress([5, 2, 0, 5], 5)).toEqual({ done: 12, total: 20, complete: 2 });
  });
  it("is empty for an empty squad", () => {
    expect(reviewProgress([], 5)).toEqual({ done: 0, total: 0, complete: 0 });
  });
});

describe("nextIncomplete", () => {
  it("finds the next child with something left", () => {
    expect(nextIncomplete([5, 5, 2, 0], 5, 0)).toBe(2);
    expect(nextIncomplete([5, 5, 2, 0], 5, 2)).toBe(3);
  });
  it("wraps round to the start", () => {
    expect(nextIncomplete([1, 5, 5, 5], 5, 3)).toBe(0);
  });
  it("can come back to the current child if they are the only one left", () => {
    expect(nextIncomplete([5, 3, 5], 5, 1)).toBe(1);
  });
  it("is null when everyone is complete or the squad is empty", () => {
    expect(nextIncomplete([5, 5], 5, 0)).toBeNull();
    expect(nextIncomplete([], 5, 0)).toBeNull();
  });
});

describe("clampIndex", () => {
  it("keeps the index inside the squad", () => {
    expect(clampIndex(-1, 4)).toBe(0);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(2, 4)).toBe(2);
    expect(clampIndex(3, 0)).toBe(0);
  });
});
