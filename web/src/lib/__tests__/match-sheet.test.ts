import { buildSheetRows, positionCode, readSheetPlan } from "../match-sheet";

const squad = [
  { id: "a", full_name: "Zola", position: "cf" },
  { id: "b", full_name: "Ayanda", position: "gk" },
  { id: "c", full_name: "Musa", position: "cb" },
  { id: "d", full_name: "Lwazi", position: null },
];

describe("positionCode", () => {
  it("reads the short code from the position label", () => {
    expect(positionCode("cb")).toBe("CB");
    expect(positionCode("gk")).toBe("GK");
    expect(positionCode(null)).toBe("");
    expect(positionCode("libero")).toBe("LIBERO");
  });
});

describe("buildSheetRows before the match", () => {
  it("lists available players goalkeeper to forward, then the unavailable", () => {
    const rows = buildSheetRows({ squad, availability: { c: { status: "injured" } } });
    expect(rows.map((r) => r.name)).toEqual(["Ayanda", "Zola", "Lwazi", "Musa"]);
    expect(rows.find((r) => r.id === "c")?.availability).toBe("Injured");
    expect(rows.every((r) => r.played === null && r.rating === null)).toBe(true);
  });

  it("says Unavailable for any other non-available status", () => {
    expect(buildSheetRows({ squad, availability: { a: { status: "unavailable" } } }).find((r) => r.id === "a")?.availability).toBe(
      "Unavailable"
    );
    expect(buildSheetRows({ squad, availability: { a: { status: "available" } } }).find((r) => r.id === "a")?.availability).toBeNull();
  });
});

describe("buildSheetRows after the match", () => {
  it("puts those who played first, with their rating and note", () => {
    const rows = buildSheetRows({
      squad,
      availability: {},
      appearances: [
        { player: squad[0], played: true },
        { player: squad[1], played: false },
        { player: squad[2], played: true },
      ],
      ratings: [{ playerId: "a", rating: 4, note: "Good runs" }],
    });
    expect(rows.map((r) => [r.name, r.played])).toEqual([
      ["Musa", true],
      ["Zola", true],
      ["Ayanda", false],
      ["Lwazi", null],
    ]);
    expect(rows.find((r) => r.id === "a")).toMatchObject({ rating: 4, note: "Good runs" });
  });

  it("keeps a player who appeared but has since left the squad", () => {
    const rows = buildSheetRows({
      squad: [],
      availability: {},
      appearances: [{ player: { id: "x", full_name: "Sipho", position: "cm" }, played: true }],
    });
    expect(rows.map((r) => r.name)).toEqual(["Sipho"]);
  });
});

describe("readSheetPlan", () => {
  it("reads the printable parts of a saved plan", () => {
    const plan = readSheetPlan({
      planSummary: "Press their centre backs",
      inPossession: ["Play wide", 3, ""],
      setPieces: { attacking: "Near post", defending: "" },
      teamTalk: ["Enjoy it"],
    });
    expect(plan).toEqual({
      summary: "Press their centre backs",
      shape: null,
      inPossession: ["Play wide"],
      outOfPossession: [],
      setPieces: { attacking: "Near post", defending: "" },
      teamTalk: ["Enjoy it"],
    });
  });

  it("returns null for nothing usable", () => {
    expect(readSheetPlan(null)).toBeNull();
    expect(readSheetPlan("plan")).toBeNull();
    expect(readSheetPlan({ planSummary: "  ", inPossession: [] })).toBeNull();
  });
});
