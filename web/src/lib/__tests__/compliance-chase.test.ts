import { buildChase, chaseMessage, daysToFixture, type ChasePlayer } from "../compliance-chase";
import { DOCUMENTS } from "../document-definitions";

const NOW = new Date("2026-10-07T08:00:00Z"); // a Wednesday
const allDone = () => new Map(DOCUMENTS.map((d) => [d.type, d.uploadOnly ? "uploaded" : "signed"]));
const none = { overage: new Set<string>(), duplicate: new Set<string>() };

function player(over: Partial<ChasePlayer> & { id: string }): ChasePlayer {
  return { name: over.id, ageGroup: "U13", safaNumber: "S1", docStatus: allDone(), nextFixture: null, ...over };
}

describe("daysToFixture", () => {
  it("counts days to a fixture inside the week", () => {
    expect(daysToFixture("2026-10-11T09:00:00Z", NOW)).toBe(5);
  });
  it("ignores fixtures beyond the window, in the past, or missing", () => {
    expect(daysToFixture("2026-10-30T09:00:00Z", NOW)).toBeNull();
    expect(daysToFixture("2026-10-01T09:00:00Z", NOW)).toBeNull();
    expect(daysToFixture(null, NOW)).toBeNull();
  });
});

describe("buildChase", () => {
  it("lists nobody when everyone is complete and unflagged", () => {
    expect(buildChase([player({ id: "a" })], none, "Growfit", "2026", NOW)).toEqual([]);
  });

  it("puts a gap with a fixture this week above a bigger gap with none", () => {
    const ready = new Map<string, string>();
    const list = buildChase(
      [
        player({ id: "far", docStatus: ready }), // all six missing, no fixture
        player({ id: "soon", docStatus: new Map([...allDone()].slice(1)), nextFixture: "2026-10-11T09:00:00Z" }), // one missing, Sunday
      ],
      none, "Growfit", "2026", NOW,
    );
    expect(list.map((i) => i.playerId)).toEqual(["soon", "far"]);
    expect(list[0].fixtureInDays).toBe(5);
    expect(list[0].message).toContain("They play in 5 days");
  });

  it("treats a missing SAFA number as a parent ask and ranks it above documents alone", () => {
    const list = buildChase(
      [
        player({ id: "docs", docStatus: new Map([...allDone()].slice(2)) }),
        player({ id: "safa", safaNumber: null }),
      ],
      none, "Growfit", "2026", NOW,
    );
    expect(list[0].playerId).toBe("safa");
    expect(list[0].message).toContain("their SAFA registration number");
  });

  it("lists age and duplicate flags last, with no parent message and no mention in one", () => {
    const list = buildChase(
      [
        player({ id: "old" }),
        player({ id: "gap", docStatus: new Map([...allDone()].slice(1)) }),
      ],
      { overage: new Set(["old"]), duplicate: new Set() }, "Growfit", "2026", NOW,
    );
    expect(list.map((i) => i.playerId)).toEqual(["gap", "old"]);
    expect(list[1].message).toBe("");
    expect(list[0].message).not.toMatch(/age|duplicate/i);
  });

  it("breaks ties on name so the order is stable", () => {
    const miss = new Map<string, string>();
    const list = buildChase([player({ id: "b", name: "Bheki", docStatus: miss }), player({ id: "a", name: "Ayanda", docStatus: miss })], none, "G", "2026", NOW);
    expect(list.map((i) => i.name)).toEqual(["Ayanda", "Bheki"]);
  });
});

describe("chaseMessage", () => {
  it("joins several asks in plain words", () => {
    const m = chaseMessage({ name: "Sipho", missingDocs: ["Medical Form", "Code of Ethics"], reasons: ["documents", "no-safa"], fixtureInDays: null }, "Growfit", "2026");
    expect(m).toContain("Medical Form, Code of Ethics and their SAFA registration number");
    expect(m).not.toContain("They play");
  });
  it("says tomorrow for a fixture a day away", () => {
    expect(chaseMessage({ name: "S", missingDocs: ["X"], reasons: ["documents"], fixtureInDays: 1 }, "G", "2026")).toContain("They play tomorrow");
  });
});
