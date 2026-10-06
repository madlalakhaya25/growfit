import { buildDigest, planDigestDrafts, teamFocusText, weekKeyFor, type DigestFacts, type DigestPlayerFacts } from "../weekly-digest";
import { findFlaggedWording } from "../child-safe-check";

const base: DigestFacts = {
  firstName: "Sipho", sessionsHeld: 2, sessionsAttended: 2, matchesPlayed: 1,
  nextFixture: { opponent: "Hawks", when: "Sunday 12 October" },
  homeChallenge: { what: "Juggle the ball ten times", how: "Use both feet.", timesPerWeek: 3 },
};

describe("weekKeyFor", () => {
  it("is the Monday on or before the date", () => {
    expect(weekKeyFor("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(weekKeyFor("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(weekKeyFor("2026-10-07")).toBe("2026-10-05"); // Wednesday
    expect(weekKeyFor("2026-10-02")).toBe("2026-09-28"); // Friday, across a month
  });
});

describe("buildDigest", () => {
  it("tells the week, one thing to try at home and the next match", () => {
    expect(buildDigest(base)).toBe(
      "This week Sipho was at all 2 training sessions and played in the match. Well done. " +
      "One thing to try at home, 3 times this week: Juggle the ball ten times. Use both feet. " +
      "Next up: Hawks on Sunday 12 October. Thank you for all your support.",
    );
  });

  it("counts a partial week without comparing it to what was held", () => {
    const text = buildDigest({ ...base, sessionsAttended: 1, matchesPlayed: 0, homeChallenge: null })!;
    expect(text).toContain("came to 1 training session.");
    expect(text).not.toMatch(/of 2|missed/);
  });

  it("never mentions an absence: a child who came to nothing gets no week line", () => {
    const text = buildDigest({ ...base, sessionsAttended: 0, matchesPlayed: 0 })!;
    expect(text).not.toContain("This week");
    expect(text).toContain("One thing to try at home");
  });

  it("says nothing at all when there is nothing kind and true to say", () => {
    expect(buildDigest({ ...base, sessionsAttended: 0, matchesPlayed: 0, homeChallenge: null })).toBeNull();
  });

  it("leaves out the next fixture when there is none", () => {
    expect(buildDigest({ ...base, nextFixture: null })).not.toContain("Next up");
  });

  it("never trips the player-facing wording check", () => {
    expect(findFlaggedWording(buildDigest(base)!)).toEqual([]);
  });
});

describe("teamFocusText", () => {
  it("names the phase of play in family words, never the coach's own text", () => {
    expect(teamFocusText(["in_possession"])).toBe("This week the team worked on keeping and using the ball.");
    expect(teamFocusText(["set_pieces", "attacking_transition"])).toBe(
      "This week the team worked on corners, free kicks and throw-ins and what we do the moment we win the ball.",
    );
  });

  it("says each thing once, and nothing when no phase is set", () => {
    expect(teamFocusText(["set_pieces", "set_pieces"])).toBe("This week the team worked on corners, free kicks and throw-ins.");
    expect(teamFocusText([null])).toBeNull();
    expect(teamFocusText([])).toBeNull();
  });

  it("passes the player-facing wording check for every phase", () => {
    const all = ["in_possession", "out_of_possession", "attacking_transition", "defensive_transition", "set_pieces"] as const;
    for (const p of all) expect(findFlaggedWording(teamFocusText([p])!)).toEqual([]);
  });
});

describe("buildDigest with a team focus", () => {
  it("adds the team line between the week and the home challenge", () => {
    const text = buildDigest({ ...base, teamFocus: "This week the team worked on keeping and using the ball." })!;
    expect(text).toContain("Well done. This week the team worked on keeping and using the ball. One thing to try at home");
  });

  it("never makes a note on its own", () => {
    expect(buildDigest({ ...base, sessionsAttended: 0, matchesPlayed: 0, homeChallenge: null, teamFocus: "This week the team worked on x." })).toBeNull();
  });
});

describe("planDigestDrafts", () => {
  const player = (id: string, over: Partial<DigestPlayerFacts> = {}): DigestPlayerFacts => ({ ...base, playerId: id, fullName: `Kid${id} Surname`, ...over });

  it("skips children who already have a note and children with nothing to say", () => {
    const drafts = planDigestDrafts(
      [player("a"), player("b"), player("c", { sessionsAttended: 0, matchesPlayed: 0, homeChallenge: null })],
      new Set(["a"]),
    );
    expect(drafts.map((d) => d.playerId)).toEqual(["b"]);
    expect(drafts[0].body).toContain("This week Kidb ");
  });
});
