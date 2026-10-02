import { suggestTerms, isIsoDate, termProblem, currentTerm, overlappingTerms } from "@/lib/school-terms";

const T = (name: string, a: string, b: string) => ({ name, starts_on: a, ends_on: b });

describe("suggestTerms", () => {
  it("gives four exact terms for 2026", () => {
    const s = suggestTerms(2026);
    expect(s.approximate).toBe(false);
    expect(s.terms).toHaveLength(4);
    expect(s.terms[0]).toEqual(T("Term 1 2026", "2026-01-14", "2026-03-27"));
    expect(s.terms[3].ends_on).toBe("2026-12-09");
  });

  it("estimates other years and says so", () => {
    const s = suggestTerms(2027);
    expect(s.approximate).toBe(true);
    expect(s.terms[1].starts_on).toBe("2027-04-08");
    expect(s.terms[1].name).toBe("Term 2 2027");
  });

  it("never overlaps or runs backwards", () => {
    for (const y of [2026, 2027]) {
      const { terms } = suggestTerms(y);
      expect(overlappingTerms(terms)).toEqual([]);
      for (const t of terms) expect(termProblem(t)).toBeNull();
    }
  });
});

describe("isIsoDate", () => {
  it("accepts real dates and rejects impossible ones", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe("termProblem", () => {
  it("flags an empty name, bad dates and a reversed range", () => {
    expect(termProblem(T("", "2026-01-01", "2026-02-01"))).toMatch(/name/);
    expect(termProblem(T("x", "2026-13-01", "2026-02-01"))).toMatch(/real dates/);
    expect(termProblem(T("x", "2026-03-01", "2026-02-01"))).toMatch(/before it starts/);
    expect(termProblem(T("x", "2026-03-01", "2026-03-01"))).toBeNull();
  });
});

describe("currentTerm", () => {
  const terms = [T("T2", "2026-04-08", "2026-06-26"), T("T1", "2026-01-14", "2026-03-27"), T("T3", "2026-07-21", "2026-10-02")];

  it("picks the running term, on both boundary days", () => {
    expect(currentTerm(terms, "2026-05-01")?.name).toBe("T2");
    expect(currentTerm(terms, "2026-10-02")?.name).toBe("T3");
    expect(currentTerm(terms, "2026-01-14")?.name).toBe("T1");
  });

  it("falls to the next term in a holiday, then the last one when the year is over", () => {
    expect(currentTerm(terms, "2026-04-01")?.name).toBe("T2");
    expect(currentTerm(terms, "2026-12-01")?.name).toBe("T3");
  });

  it("is null with no terms", () => {
    expect(currentTerm([], "2026-05-01")).toBeNull();
  });
});

describe("overlappingTerms", () => {
  it("returns both sides of an overlap", () => {
    const a = T("A", "2026-01-01", "2026-03-31");
    const b = T("B", "2026-03-31", "2026-06-01");
    const c = T("C", "2026-07-01", "2026-09-01");
    expect(overlappingTerms([c, b, a])).toEqual(expect.arrayContaining([a, b]));
    expect(overlappingTerms([c, b, a])).not.toContain(c);
  });
});

import { todayIso } from "@/lib/time";

describe("todayIso", () => {
  it("uses the academy's timezone, not UTC", () => {
    // 22:30 UTC on 1 Oct is 00:30 on 2 Oct in South Africa.
    expect(todayIso(new Date("2026-10-01T22:30:00Z"))).toBe("2026-10-02");
    expect(todayIso(new Date("2026-10-01T10:00:00Z"))).toBe("2026-10-01");
  });
});

import { previousTerm } from "@/lib/school-terms";

describe("previousTerm", () => {
  const t1 = T("T1", "2026-01-14", "2026-03-27");
  const t2 = T("T2", "2026-04-08", "2026-06-26");
  const t3 = T("T3", "2026-07-21", "2026-10-02");
  it("returns the term that started just before", () => {
    expect(previousTerm([t3, t1, t2], t3)).toBe(t2);
    expect(previousTerm([t3, t1, t2], t2)).toBe(t1);
  });
  it("is null for the first term", () => {
    expect(previousTerm([t1, t2], t1)).toBeNull();
  });
});
