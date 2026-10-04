import { SKILL_CHALLENGES, resultFor, type ChallengeResult } from "@/lib/skill-challenges";
import { challengeSubtitle, challengeToBeat, homeworkDue, latestMedal, streakLabel } from "@/lib/player-today";

const hw = (id: string, dueDate: string, done = false) => ({ id, title: id, dueDate, done });

describe("homeworkDue", () => {
  it("is the open item due soonest", () => {
    expect(homeworkDue([hw("late", "2026-10-20"), hw("soon", "2026-10-08"), hw("done", "2026-10-01", true)])?.id).toBe("soon");
  });
  it("is null when nothing is open", () => {
    expect(homeworkDue([])).toBeNull();
    expect(homeworkDue([hw("a", "2026-10-01", true)])).toBeNull();
  });
});

describe("challengeToBeat", () => {
  const c = SKILL_CHALLENGES[0];
  const result = (best: number | null): ChallengeResult =>
    resultFor(c, "U11", best === null ? [] : [{ player_id: "p", challenge_key: c.key, value: best, logged_at: "2026-10-01T10:00:00Z" }]);

  it("is null with nothing assigned", () => {
    expect(challengeToBeat([], "U11")).toBeNull();
  });
  it("names the first challenge and the first trophy to aim for when none are won", () => {
    const r = challengeToBeat([{ challenge: c, dueOn: "2026-10-12", result: result(null) }], "U11");
    expect(r).toMatchObject({ key: c.key, name: c.name, dueOn: "2026-10-12", best: null });
    expect(r?.next).toEqual({ trophy: "bronze", target: c.targets.U11.bronze });
  });
  it("has no next target once gold is won", () => {
    const gold = c.targets.U11.gold;
    const r = challengeToBeat([{ challenge: c, dueOn: "2026-10-12", result: result(gold) }], "U11");
    expect(r?.next).toBeNull();
  });
});

describe("latestMedal", () => {
  const a = SKILL_CHALLENGES[0];
  const b = SKILL_CHALLENGES[1];
  const won = (ch: typeof a, at: string): ChallengeResult => ({ challenge: ch, best: 1, trophy: "gold", attempts: 1, lastLoggedAt: at });
  it("is the trophy with the most recent attempt", () => {
    expect(latestMedal([won(a, "2026-10-01T10:00:00Z"), won(b, "2026-10-03T10:00:00Z")])?.challenge.key).toBe(b.key);
  });
  it("skips results with no trophy and is null for none", () => {
    expect(latestMedal([{ challenge: a, best: null, trophy: null, attempts: 0, lastLoggedAt: null }])).toBeNull();
    expect(latestMedal([])).toBeNull();
  });
});

describe("challengeSubtitle", () => {
  it("names the target and the player's best", () => {
    expect(challengeSubtitle({ best: 9, next: { trophy: "silver", target: 12 } })).toBe("Beat 12 for Silver (your best: 9)");
  });
  it("leaves the best out when there is none", () => {
    expect(challengeSubtitle({ best: null, next: { trophy: "bronze", target: 5 } })).toBe("Beat 5 for Bronze");
  });
  it("says gold is won when there is no next target", () => {
    expect(challengeSubtitle({ best: 30, next: null })).toBe("Gold won, best 30");
  });
});

describe("streakLabel", () => {
  it("is empty for no streak and pluralises weeks", () => {
    expect(streakLabel(0)).toBeUndefined();
    expect(streakLabel(1)).toBe("1 week in a row");
    expect(streakLabel(3)).toBe("3 weeks in a row");
  });
});
