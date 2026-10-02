import { buildMatchStory, firstNameOf, outcomeOf, usableNote, type StoryInput } from "../match-story";

const base: StoryInput = {
  firstName: "Sipho", opponent: "Hawks", isHome: true, teamScore: 3, opponentScore: 1,
  rating: 4, coachNote: null, played: true,
};

describe("outcomeOf", () => {
  it("reads win, draw, loss and unknown", () => {
    expect([outcomeOf(2, 1), outcomeOf(1, 1), outcomeOf(0, 2), outcomeOf(null, 1)]).toEqual(["win", "draw", "loss", "unknown"]);
  });
});

describe("buildMatchStory", () => {
  it("tells a win with the score and the child's good game", () => {
    expect(buildMatchStory(base)).toBe(
      "The team won 3-1 against Hawks at home. What a day. Sipho had a really good game, and the coaches noticed.",
    );
  });

  it("keeps a loss warm and never uses a negative word", () => {
    const text = buildMatchStory({ ...base, teamScore: 0, opponentScore: 2, rating: 2, isHome: false });
    expect(text).toContain("ended 0-2");
    expect(text).toContain("plenty to build on");
    expect(text).toContain("worked hard out there");
    expect(text).not.toMatch(/poor|bad|weak|lost|failed|mistake/i);
  });

  it("never states a rating number or compares with others", () => {
    const text = buildMatchStory({ ...base, rating: 5 });
    expect(text).not.toMatch(/\b[1-5]\s*(\/|out of)\s*5\b|★/);
    expect(text).not.toMatch(/better than|other players|teammates/i);
  });

  it("is kind to a child who did not play, and quotes no note for them", () => {
    const text = buildMatchStory({ ...base, played: false, rating: null, coachNote: "Great energy" });
    expect(text).toContain("cheered the team on");
    expect(text).not.toContain("Great energy");
  });

  it("adds the coach's kind note, with a full stop", () => {
    expect(buildMatchStory({ ...base, coachNote: "  Brave tackling in midfield  " })).toMatch(/Coach says: Brave tackling in midfield\.$/);
  });

  it("leaves out a note that trips the wording check", () => {
    const text = buildMatchStory({ ...base, coachNote: "Struggled with his weak left foot" });
    expect(text).not.toMatch(/Coach says|struggled|weak/i);
  });

  it("does not invent a score when none was logged", () => {
    const text = buildMatchStory({ ...base, teamScore: null, opponentScore: null });
    expect(text).toBe("The team played Hawks at home. Sipho had a really good game, and the coaches noticed.");
  });
});

describe("usableNote / firstNameOf", () => {
  it("drops blank notes", () => {
    expect(usableNote("   ")).toBeNull();
    expect(usableNote(null)).toBeNull();
  });
  it("uses the first name only", () => {
    expect(firstNameOf("Sipho Dlamini")).toBe("Sipho");
    expect(firstNameOf("  ")).toBe("Your child");
  });
});

import { planStoryDrafts } from "../match-story";

describe("planStoryDrafts", () => {
  const fixture = { opponent: "Hawks", isHome: true, teamScore: 2, opponentScore: 0 };
  const squad = [
    { playerId: "a", fullName: "Sipho Dlamini", played: true, ratings: [{ rating: 4, note: null }, { rating: 5, note: " Great energy " }] },
    { playerId: "b", fullName: "Bheki Zulu", played: false, ratings: [] },
    { playerId: "c", fullName: "Cebo Ndlovu", played: true, ratings: [{ rating: 3, note: null }] },
  ];

  it("writes a draft per child and averages two coaches' ratings", () => {
    const drafts = planStoryDrafts(fixture, squad, new Set());
    expect(drafts.map((d) => d.playerId)).toEqual(["a", "b", "c"]);
    expect(drafts[0].body).toContain("Sipho had a really good game");
    expect(drafts[0].body).toContain("Coach says: Great energy.");
    expect(drafts[1].body).toContain("cheered the team on");
  });

  it("leaves children who already have a message untouched", () => {
    const drafts = planStoryDrafts(fixture, squad, new Set(["a", "c"]));
    expect(drafts.map((d) => d.playerId)).toEqual(["b"]);
  });
});
