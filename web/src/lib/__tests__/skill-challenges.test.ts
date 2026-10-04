import {
  SKILL_CHALLENGES,
  SKILL_AGE_BANDS,
  assignedForPlayer,
  getSkillChallenge,
  isValidScore,
  nextTarget,
  personalBest,
  skillAgeBand,
  teamChallengeSummary,
  trophyCabinet,
  trophyFor,
  weeklyStreak,
  type AttemptRow,
  type SkillChallenge,
} from "@/lib/skill-challenges";

const keepy = getSkillChallenge("keepy_uppies") as SkillChallenge;
const weave = getSkillChallenge("cone_weave") as SkillChallenge;

describe("catalogue", () => {
  it("has about ten challenges with unique keys, 2-3 steps, and ordered targets per age band", () => {
    expect(SKILL_CHALLENGES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SKILL_CHALLENGES.map((c) => c.key)).size).toBe(SKILL_CHALLENGES.length);
    for (const c of SKILL_CHALLENGES) {
      expect(c.key).toMatch(/^[a-z0-9_]{1,40}$/); // the migration's CHECK
      expect(c.steps.length).toBeGreaterThanOrEqual(2);
      expect(c.steps.length).toBeLessThanOrEqual(3);
      for (const band of SKILL_AGE_BANDS) {
        const t = c.targets[band];
        if (c.better === "higher") expect(t.bronze < t.silver && t.silver < t.gold).toBe(true);
        else expect(t.bronze > t.silver && t.silver > t.gold).toBe(true);
      }
    }
  });

  it("asks more of older children", () => {
    for (const c of SKILL_CHALLENGES) {
      const harder = c.better === "higher" ? (a: number, b: number) => b >= a : (a: number, b: number) => b <= a;
      expect(harder(c.targets.U11.gold, c.targets.U13.gold)).toBe(true);
      expect(harder(c.targets.U13.gold, c.targets.U15.gold)).toBe(true);
    }
  });

  it("returns null for an unknown key", () => {
    expect(getSkillChallenge("nope")).toBeNull();
  });
});

describe("skillAgeBand", () => {
  it.each([
    ["U9", "U11"], ["U11", "U11"], ["U12", "U13"], ["u13", "U13"], ["U14", "U15"], ["U15", "U15"], ["U17", "U15"],
    [null, "U13"], ["Seniors", "U13"],
  ])("%s -> %s", (input, band) => {
    expect(skillAgeBand(input)).toBe(band);
  });
});

describe("trophyFor", () => {
  it("counts: more is better, the target itself earns the medal", () => {
    expect(trophyFor(keepy, "U11", 9)).toBeNull();
    expect(trophyFor(keepy, "U11", 10)).toBe("bronze");
    expect(trophyFor(keepy, "U11", 25)).toBe("silver");
    expect(trophyFor(keepy, "U11", 49)).toBe("silver");
    expect(trophyFor(keepy, "U11", 50)).toBe("gold");
    expect(trophyFor(keepy, "U15", 50)).toBe("bronze");
  });

  it("times: faster is better", () => {
    expect(trophyFor(weave, "U11", 26)).toBeNull();
    expect(trophyFor(weave, "U11", 25)).toBe("bronze");
    expect(trophyFor(weave, "U11", 20)).toBe("silver");
    expect(trophyFor(weave, "U11", 16)).toBe("gold");
    expect(trophyFor(weave, "U11", 10)).toBe("gold");
  });
});

describe("personalBest and nextTarget", () => {
  it("picks the highest count or the fastest time", () => {
    expect(personalBest(keepy, [])).toBeNull();
    expect(personalBest(keepy, [12, 40, 7])).toBe(40);
    expect(personalBest(weave, [22, 18, 30])).toBe(18);
  });

  it("names the next medal up, or null once gold is won", () => {
    expect(nextTarget(keepy, "U11", null)).toEqual({ trophy: "bronze", target: 10 });
    expect(nextTarget(keepy, "U11", 12)).toEqual({ trophy: "silver", target: 25 });
    expect(nextTarget(weave, "U13", 18)).toEqual({ trophy: "gold", target: 14 });
    expect(nextTarget(keepy, "U11", 60)).toBeNull();
  });
});

describe("isValidScore", () => {
  it("accepts whole numbers in range only", () => {
    expect(isValidScore(keepy, 0)).toBe(true);
    expect(isValidScore(keepy, 2000)).toBe(true);
    expect(isValidScore(keepy, 2001)).toBe(false);
    expect(isValidScore(keepy, -1)).toBe(false);
    expect(isValidScore(keepy, 3.5)).toBe(false);
    expect(isValidScore(keepy, "5")).toBe(false);
    expect(isValidScore(weave, 0)).toBe(false);
    expect(isValidScore(weave, 600)).toBe(true);
    expect(isValidScore(weave, 601)).toBe(false);
  });
});

describe("weeklyStreak", () => {
  // 2026-10-04 is a Sunday; its week starts Monday 2026-09-28.
  const today = "2026-10-04";
  it("is zero with no attempts", () => {
    expect(weeklyStreak([], today)).toBe(0);
  });

  it("counts consecutive weeks back from this week, several attempts in a week count once", () => {
    const at = ["2026-10-03T08:00:00Z", "2026-09-29T08:00:00Z", "2026-09-22T08:00:00Z", "2026-09-14T08:00:00Z"];
    expect(weeklyStreak(at, today)).toBe(3);
  });

  it("does not break the streak just because this week has no attempt yet", () => {
    expect(weeklyStreak(["2026-10-01T08:00:00Z", "2026-09-24T08:00:00Z"], "2026-10-05")).toBe(2);
  });

  it("is broken by a missed week", () => {
    expect(weeklyStreak(["2026-09-15T08:00:00Z"], today)).toBe(0);
  });

  it("uses academy time: Sunday 23:30 SAST belongs to that week, not the next", () => {
    // 2026-09-27T21:30Z is Sunday 23:30 in Johannesburg (week of 2026-09-21).
    expect(weeklyStreak(["2026-09-27T21:30:00Z"], "2026-09-28")).toBe(1);
    expect(weeklyStreak(["2026-09-27T22:30:00Z"], "2026-09-28")).toBe(1); // Monday 00:30, this week
    expect(weeklyStreak(["2026-09-27T21:30:00Z"], "2026-10-05")).toBe(0);
  });
});

const row = (player_id: string, challenge_key: string, value: number, logged_at = "2026-10-01T08:00:00Z"): AttemptRow => ({
  player_id, challenge_key, value, logged_at,
});

describe("trophyCabinet", () => {
  it("lists only challenges with a medal, gold first", () => {
    const rows = [row("p", "keepy_uppies", 12), row("p", "keepy_uppies", 30), row("p", "cone_weave", 15), row("p", "toe_taps_30", 5)];
    const cab = trophyCabinet("U11", rows);
    expect(cab.map((r) => [r.challenge.key, r.trophy, r.best])).toEqual([
      ["cone_weave", "gold", 15],
      ["keepy_uppies", "silver", 30],
    ]);
  });
});

describe("teamChallengeSummary", () => {
  it("splits done from not-yet, best first, with medals", () => {
    const players = [{ id: "a", name: "Ayanda" }, { id: "b", name: "Bongani" }, { id: "c", name: "Cebo" }];
    const rows = [row("a", "keepy_uppies", 20), row("b", "keepy_uppies", 55), row("b", "keepy_uppies", 3), row("c", "toe_taps_30", 40)];
    const s = teamChallengeSummary(keepy, "U11", players, rows);
    expect(s.done.map((d) => [d.name, d.result.best, d.result.trophy, d.result.attempts])).toEqual([
      ["Bongani", 55, "gold", 2],
      ["Ayanda", 20, "bronze", 1],
    ]);
    expect(s.notYet.map((p) => p.name)).toEqual(["Cebo"]);
  });

  it("ranks fastest first for timed challenges", () => {
    const players = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
    const s = teamChallengeSummary(weave, "U13", players, [row("a", "cone_weave", 20), row("b", "cone_weave", 15)]);
    expect(s.done.map((d) => d.playerId)).toEqual(["b", "a"]);
  });
});

describe("assignedForPlayer", () => {
  it("keeps team-wide and own assignments, one per challenge (latest due), soonest first", () => {
    const list = assignedForPlayer(
      [
        { id: "1", player_id: null, challenge_key: "keepy_uppies", due_on: "2026-10-10" },
        { id: "2", player_id: null, challenge_key: "keepy_uppies", due_on: "2026-10-20" },
        { id: "3", player_id: "me", challenge_key: "cone_weave", due_on: "2026-10-08" },
        { id: "4", player_id: "other", challenge_key: "toe_taps_30", due_on: "2026-10-08" },
        { id: "5", player_id: null, challenge_key: "retired_challenge", due_on: "2026-10-08" },
      ],
      "me"
    );
    expect(list.map((a) => [a.assignmentId, a.challenge.key, a.personal])).toEqual([
      ["3", "cone_weave", true],
      ["2", "keepy_uppies", false],
    ]);
  });
});
