import { ADMIN_CARDS, adminCardsFor, cleanHats, coachCardsFor, isStaffHat } from "../staff-hats";

describe("isStaffHat / cleanHats", () => {
  it("accepts only known hats", () => {
    expect(isStaffHat("director")).toBe(true);
    expect(isStaffHat("owner")).toBe(false);
    expect(isStaffHat(3)).toBe(false);
  });

  it("keeps known hats once each in display order and drops the rest", () => {
    expect(cleanHats(["finance", "director", "finance", "owner", 4, null])).toEqual(["director", "finance"]);
    expect(cleanHats("director")).toEqual([]);
    expect(cleanHats(undefined)).toEqual([]);
  });
});

describe("adminCardsFor", () => {
  it("shows every card when there are no hats", () => {
    expect(adminCardsFor([])).toEqual(ADMIN_CARDS);
  });

  it("always keeps the core card", () => {
    expect(adminCardsFor(["equipment"])).toEqual(["quick_actions"]);
  });

  it("shows what a hat wants", () => {
    expect(adminCardsFor(["safeguarding"])).toEqual(["welfare", "quick_actions"]);
    expect(adminCardsFor(["registration"])).toEqual(["registration", "quick_actions"]);
  });

  it("joins the cards of two hats without repeating one", () => {
    expect(adminCardsFor(["registration", "safeguarding"])).toEqual(["registration", "welfare", "quick_actions"]);
    expect(adminCardsFor(["director"])).toEqual(["registration", "welfare", "fixtures", "objectives", "stats", "quick_actions"]);
  });

  it("gives the technical director the curriculum cards and not the registration ones", () => {
    expect(adminCardsFor(["technical_director"])).toEqual(["objectives", "coverage", "sessions", "stats", "quick_actions"]);
  });
});

describe("coachCardsFor", () => {
  it("adds nothing for a coach with no hats, as before hats existed", () => {
    expect(coachCardsFor([])).toEqual([]);
  });
  it("gives a director the match and objective cards, and a technical director the coaching cards", () => {
    expect(coachCardsFor(["director"])).toEqual(["fixtures", "objectives"]);
    expect(coachCardsFor(["technical_director"])).toEqual(["objectives", "coverage", "sessions"]);
  });
  it("combines hats without repeating a card, and never adds admin-only cards", () => {
    expect(coachCardsFor(["director", "technical_director"])).toEqual(["fixtures", "objectives", "coverage", "sessions"]);
    expect(coachCardsFor(["registration", "safeguarding", "finance", "fundraising", "equipment"])).toEqual([]);
  });
});
