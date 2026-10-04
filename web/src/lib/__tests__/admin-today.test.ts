import { DOCUMENTS } from "@/lib/document-definitions";
import { missingDocCount, summariseCompliance } from "@/lib/admin-today";

const done = (): Map<string, string> =>
  new Map(DOCUMENTS.map((d) => [d.type, d.uploadOnly ? "uploaded" : "signed"]));
const withMissing = (n: number): Map<string, string> => {
  const m = done();
  DOCUMENTS.slice(0, n).forEach((d) => m.delete(d.type));
  return m;
};

const teams = [
  { id: "a", name: "U11", ageGroup: "U11" },
  { id: "b", name: "U13", ageGroup: "U13" },
  { id: "c", name: "U15", ageGroup: "U15" },
];

describe("missingDocCount", () => {
  it("is 0 when every document is in and the total when none are", () => {
    expect(missingDocCount(done())).toBe(0);
    expect(missingDocCount(new Map())).toBe(DOCUMENTS.length);
  });
  it("treats unsigned and needs_renewal as outstanding", () => {
    const m = done();
    m.set(DOCUMENTS[0].type, "needs_renewal");
    expect(missingDocCount(m)).toBe(1);
  });
});

describe("summariseCompliance", () => {
  it("counts fully registered players and rounds the percentage", () => {
    const s = summariseCompliance(
      [
        { id: "1", teamId: "a", docStatus: done() },
        { id: "2", teamId: "a", docStatus: done() },
        { id: "3", teamId: "b", docStatus: withMissing(2) },
      ],
      teams,
    );
    expect(s.players).toBe(3);
    expect(s.complete).toBe(2);
    expect(s.pct).toBe(67);
  });

  it("is 0% and empty for an academy with no players", () => {
    expect(summariseCompliance([], teams)).toEqual({ players: 0, complete: 0, pct: 0, byTeam: [] });
  });

  it("lists the team with the most outstanding documents first and skips empty teams", () => {
    const s = summariseCompliance(
      [
        { id: "1", teamId: "a", docStatus: withMissing(1) },
        { id: "2", teamId: "b", docStatus: withMissing(3) },
        { id: "3", teamId: "b", docStatus: done() },
      ],
      teams,
    );
    expect(s.byTeam.map((t) => t.teamId)).toEqual(["b", "a"]);
    expect(s.byTeam[0]).toMatchObject({ players: 2, complete: 1, missingDocs: 3 });
  });

  it("breaks ties on team name", () => {
    const s = summariseCompliance(
      [
        { id: "1", teamId: "b", docStatus: withMissing(1) },
        { id: "2", teamId: "a", docStatus: withMissing(1) },
      ],
      teams,
    );
    expect(s.byTeam.map((t) => t.name)).toEqual(["U11", "U13"]);
  });

  it("still counts a player with no team in the academy total", () => {
    const s = summariseCompliance([{ id: "1", teamId: null, docStatus: done() }], teams);
    expect(s.complete).toBe(1);
    expect(s.byTeam).toEqual([]);
  });
});
