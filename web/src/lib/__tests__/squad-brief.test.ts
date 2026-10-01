import { buildStableBrief, stableBriefKey, type StableBriefPlayer } from "../squad-brief";

const P: StableBriefPlayer[] = [
  { id: "b", full_name: "Zola Nkosi", position: "goalkeeper", date_of_birth: "2013-03-01" },
  { id: "a", full_name: "Anele Dube", position: "midfielder", date_of_birth: "2012-06-15" },
  { id: "c", full_name: "Anele Dube", position: "winger", date_of_birth: null },
];

describe("buildStableBrief", () => {
  it("is independent of the order the database returned the players in", () => {
    const one = buildStableBrief({ teamName: "U13", ageGroup: "U13", players: P });
    const two = buildStableBrief({ teamName: "U13", ageGroup: "U13", players: [...P].reverse() });
    const three = buildStableBrief({ teamName: "U13", ageGroup: "U13", players: [P[2], P[0], P[1]] });
    expect(two).toBe(one);
    expect(three).toBe(one);
  });
  it("breaks name ties by id, so two same-named players still sort stably", () => {
    const text = buildStableBrief({ teamName: "U13", ageGroup: null, players: P });
    expect(text.indexOf("Midfielder")).toBeLessThan(text.indexOf("Winger"));
  });
  it("holds roster and policy only, nothing that changes week to week", () => {
    const text = buildStableBrief({ teamName: "U13", ageGroup: "U13", players: P });
    expect(text).toContain("TEAM: U13 (U13) — 3 registered players.");
    expect(text).toContain("75%");
    expect(text).not.toMatch(/rating|form|INJURED|UNAVAILABLE|RESULTS|NEXT MATCH|attendance \d/i);
  });
});

describe("stableBriefKey", () => {
  const brief = buildStableBrief({ teamName: "U13", ageGroup: "U13", players: P });
  it("is stable for the same text and differs by academy, team and content", () => {
    expect(stableBriefKey("acad", "team", brief)).toBe(stableBriefKey("acad", "team", brief));
    expect(stableBriefKey("acad2", "team", brief)).not.toBe(stableBriefKey("acad", "team", brief));
    expect(stableBriefKey("acad", "team2", brief)).not.toBe(stableBriefKey("acad", "team", brief));
    const changed = buildStableBrief({ teamName: "U13", ageGroup: "U13", players: P.slice(1) });
    expect(stableBriefKey("acad", "team", changed)).not.toBe(stableBriefKey("acad", "team", brief));
  });
});
