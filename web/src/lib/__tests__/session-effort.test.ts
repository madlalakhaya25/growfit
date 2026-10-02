import { EFFORT_STATUSES, effortLabel, sessionEffort } from "../session-effort";

describe("effortLabel", () => {
  it("names stored values and the nearest word for others", () => {
    expect(effortLabel(3)).toBe("Easy");
    expect(effortLabel(9)).toBe("Very hard");
    expect(effortLabel(6)).toBe("Hard");
    expect(effortLabel(null)).toBeNull();
  });
});

describe("sessionEffort", () => {
  it("is the most common value, ignoring unrated children", () => {
    expect(sessionEffort([7, 7, 5, null])).toBe(7);
  });
  it("is null when nobody is rated", () => {
    expect(sessionEffort([null, null])).toBeNull();
    expect(sessionEffort([])).toBeNull();
  });
  it("breaks a tie towards the harder value, so load is never understated", () => {
    expect(sessionEffort([5, 7])).toBe(7);
  });
});

describe("EFFORT_STATUSES", () => {
  it("is who came: present and late, never absent or excused", () => {
    expect([...EFFORT_STATUSES].sort()).toEqual(["late", "present"]);
  });
});
