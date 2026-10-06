import { COPILOT_SECTIONS, copilotBrief, curriculumLines, parseCopilot, stripMarkup, MAX_COPILOT_CURRICULUM_ITEMS } from "@/lib/copilot";

const FULL = COPILOT_SECTIONS.map((s) => `${s.heading}\nline for ${s.key}`).join("\n\n");

describe("parseCopilot", () => {
  it("splits an answer on the fixed headings, in order", () => {
    const out = parseCopilot(FULL)!;
    expect(out.map((s) => s.key)).toEqual(COPILOT_SECTIONS.map((s) => s.key));
    expect(out[0]).toEqual({ key: "causes", title: "Possible causes", body: "line for causes" });
  });
  it("accepts a colon after the heading, any case, and Markdown the model added anyway", () => {
    const out = parseCopilot("## Possible causes:\n**The back four stand too deep.**\n\n### SESSION IDEAS\n* Rondo 4v2")!;
    expect(out[0].body).toBe("The back four stand too deep.");
    expect(out[1]).toMatchObject({ key: "sessions", body: "Rondo 4v2" });
  });
  it("leaves a missing section out rather than inventing it, and returns null when none is there", () => {
    const out = parseCopilot("POSSIBLE CAUSES\nSpace.\n\nCOACHING POINTS\nScan early.")!;
    expect(out.map((s) => s.key)).toEqual(["causes", "points"]);
    expect(parseCopilot("Sorry, I cannot help with that.")).toBeNull();
    expect(parseCopilot("POSSIBLE CAUSES\n   ")).toBeNull();
  });
});

describe("copilotBrief", () => {
  it("is the same every time and says when there is no curriculum", () => {
    const a = copilotBrief({ problem: " We bunch up. ", ageGroup: "U13", curriculumTitles: [] });
    expect(a).toBe(copilotBrief({ problem: "We bunch up.", ageGroup: "U13", curriculumTitles: [] }));
    expect(a).toContain("PROBLEM THE COACH SAW: We bunch up.");
    expect(a).toContain("none written yet");
  });
  it("lists the academy's items, capped", () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Item ${i}`);
    expect(curriculumLines(titles)).toHaveLength(MAX_COPILOT_CURRICULUM_ITEMS);
    expect(copilotBrief({ problem: "p", ageGroup: null, curriculumTitles: ["Pass and move"] })).toContain("- Pass and move");
  });
});

describe("stripMarkup", () => {
  it("removes asterisks and heading hashes", () => {
    expect(stripMarkup("**Hi** # there\n## Head")).toBe("Hi # there\nHead");
  });
});
