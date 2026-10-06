import { LESSON_AREAS, approvedLessons, findLesson, groupLessons, type Lesson } from "@/lib/lessons";
import { LESSONS } from "@/lib/lessons-content";

const lesson = (over: Partial<Lesson>): Lesson => ({
  slug: "a", area: "tactical", title: "A", summary: "s", body: ["p"], approved: true, ...over,
});

const SET: Lesson[] = [
  lesson({ slug: "press", area: "tactical", title: "Pressing together" }),
  lesson({ slug: "draft", area: "technical", title: "Unapproved", approved: false }),
  lesson({ slug: "safe", area: "safeguarding", title: "Two adults" }),
  lesson({ slug: "turn", area: "tactical", title: "Turning" }),
];

describe("lessons", () => {
  it("shows approved lessons only", () => {
    expect(approvedLessons(SET).map((l) => l.slug)).toEqual(["press", "safe", "turn"]);
  });
  it("groups by area in the fixed area order, leaves empty areas out, keeps written order inside", () => {
    const g = groupLessons(SET);
    expect(g.map((x) => x.area.key)).toEqual(["tactical", "safeguarding"]);
    expect(g[0].lessons.map((l) => l.slug)).toEqual(["press", "turn"]);
  });
  it("finds an approved lesson by address and treats a draft or unknown address as missing", () => {
    expect(findLesson(SET, "safe")?.title).toBe("Two adults");
    expect(findLesson(SET, "draft")).toBeNull();
    expect(findLesson(SET, "nope")).toBeNull();
  });
  it("has area keys that are unique, and every shipped lesson uses a known area and a unique address", () => {
    const keys = LESSON_AREAS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(LESSONS.every((l) => keys.includes(l.area))).toBe(true);
    expect(new Set(LESSONS.map((l) => l.slug)).size).toBe(LESSONS.length);
  });
});
