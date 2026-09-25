import {
  readOpponent, opponentLines, describeReading, zoneOf, zoneCentre, zoneRect, isZoneId, ZONE_IDS,
} from "@/lib/board-analysis";
import { compress, getPitch } from "@/lib/board-model";
import { FORMATIONS } from "@/lib/formations";

const full = getPitch("full");

/** An opponent XI placed exactly the way "Set up opponent XI" places it. */
function opponent(formationId: string) {
  const f = FORMATIONS.find((x) => x.id === formationId)!;
  return f.slots.map((slot) => ({ kind: "opponent" as const, group: "Opponent", ...compress(slot, "away") }));
}
/** Our XI placed the way "Set up my XI" does with an opponent on the board. */
function home(formationId: string) {
  const f = FORMATIONS.find((x) => x.id === formationId)!;
  return f.slots.map((slot) => ({
    kind: "player" as const,
    group: slot.role === "gk" ? "Goalkeeper" : "Midfielder",
    ...compress(slot, "home"),
  }));
}
const kinds = (tokens: Parameters<typeof readOpponent>[0]) => readOpponent(tokens, full).exploits.map((e) => e.kind);

describe("zone grid", () => {
  it("has 15 zones that round-trip through their centres", () => {
    expect(ZONE_IDS).toHaveLength(15);
    for (const id of ZONE_IDS) expect(zoneOf(zoneCentre(id))).toBe(id);
  });

  it("names the attacking third at the top and our left at small x", () => {
    expect(zoneOf({ x: 5, y: 10 })).toBe("A-LW");
    expect(zoneOf({ x: 50, y: 140 })).toBe("D-C");
    expect(zoneOf({ x: 200, y: 999 })).toBe("D-RW");
    expect(zoneRect("M-C")).toEqual(expect.objectContaining({ x: 38, w: 24 }));
  });

  it("validates ids", () => {
    expect(isZoneId("A-LHS")).toBe(true);
    expect(isZoneId("Z-9")).toBe(false);
  });
});

describe("opponentLines", () => {
  it("reads a 4-4-2 as three lines, back four first, keeper excluded", () => {
    const lines = opponentLines(opponent("11-4-4-2"));
    expect(lines.map((l) => l.players.length)).toEqual([4, 4, 2]);
    expect(lines[0].y).toBeLessThan(lines[1].y);
  });

  it("reads a 4-2-3-1 as four lines", () => {
    expect(opponentLines(opponent("11-4-2-3-1")).map((l) => l.players.length)).toEqual([4, 2, 3, 1]);
  });
});

describe("readOpponent", () => {
  it("finds the pocket between a 4-4-2's defence and midfield", () => {
    const { exploits } = readOpponent(opponent("11-4-4-2"), full);
    const pocket = exploits.find((e) => e.kind === "between-lines" && e.label.startsWith("Pocket"));
    expect(pocket).toBeDefined();
    expect(pocket!.arrow![1].y).toBeLessThan(pocket!.arrow![0].y); // arrow points toward their goal
  });

  it("finds space outside a back three", () => {
    const wide = readOpponent(opponent("11-3-5-2"), full).exploits.filter((e) => e.kind === "wide");
    expect(wide.map((e) => e.label)).toEqual(
      expect.arrayContaining([expect.stringContaining("left"), expect.stringContaining("right")])
    );
  });

  it("does not flag the flanks against a flat back four", () => {
    expect(kinds(opponent("11-4-4-2"))).not.toContain("wide");
  });

  it("flags a whole flank nobody covers", () => {
    const narrow = opponent("11-4-4-2").map((t) => (t.x > 79 ? { ...t, x: 70 } : t));
    const e = readOpponent(narrow, full).exploits.find((x) => x.kind === "wide");
    expect(e?.label).toMatch(/right flank is unguarded/);
    expect(e?.severity).toBe(3);
  });

  it("does not see space in behind a deep 5-3-2", () => {
    expect(kinds(opponent("11-5-3-2"))).not.toContain("behind-line");
  });

  it("sees space in behind a back line pushed to halfway", () => {
    const high = opponent("11-4-4-2").map((t) => ({ ...t, y: t.y + 40 }));
    const e = readOpponent(high, full).exploits.find((x) => x.kind === "behind-line");
    expect(e).toBeDefined();
    expect(e!.zoneId.startsWith("A-")).toBe(true);
  });

  it("finds a gap in a split back line", () => {
    const split = [
      ...[10, 20, 80, 90].map((x) => ({ kind: "opponent" as const, group: "Opponent", x, y: 20 })),
      ...[30, 50, 70].map((x) => ({ kind: "opponent" as const, group: "Opponent", x, y: 40 })),
    ];
    const e = readOpponent(split, full).exploits.find((x) => x.kind === "gap-in-line");
    expect(e?.label).toMatch(/back line/);
    expect(e?.zoneId).toBe("A-C");
  });

  it("counts overloads only where both sides are present", () => {
    const tokens = [
      { kind: "opponent" as const, group: "Opponent", x: 20, y: 70 },
      { kind: "opponent" as const, group: "Opponent", x: 50, y: 20 },
      { kind: "opponent" as const, group: "Opponent", x: 70, y: 20 },
      ...[10, 15, 25, 30].map((x) => ({ kind: "player" as const, group: "Midfielder", x, y: 72 })),
      // Four of ours alone in our own box: not an overload.
      ...[40, 45, 55, 60].map((x) => ({ kind: "player" as const, group: "Defender", x, y: 130 })),
    ];
    const over = readOpponent(tokens, full).exploits.filter((e) => e.kind === "overload");
    expect(over).toHaveLength(1);
    expect(over[0].label).toBe("4v1 overload in the left of the middle third");
  });

  it("works with both teams set up and caps the list, most severe first", () => {
    const { exploits } = readOpponent([...home("11-4-3-3"), ...opponent("11-3-5-2")], full);
    expect(exploits.length).toBeGreaterThan(0);
    expect(exploits.length).toBeLessThanOrEqual(6);
    const sev = exploits.map((e) => e.severity);
    expect([...sev].sort((a, b) => b - a)).toEqual(sev);
    expect(exploits.every((e) => e.source === "engine" && isZoneId(e.zoneId))).toBe(true);
  });

  it("stays quiet off the full pitch or with too few opponents", () => {
    expect(readOpponent(opponent("11-4-4-2"), getPitch("grid-small")).exploits).toEqual([]);
    expect(readOpponent(opponent("11-4-4-2").slice(0, 2), full).exploits).toEqual([]);
  });

  it("describes itself for the AI prompt with zone ids", () => {
    const text = describeReading(readOpponent(opponent("11-3-5-2"), full));
    expect(text).toMatch(/^Their outfield reads as 3 lines \(3-5-2/);
    expect(text).toMatch(/\[[ADM]-(LW|LHS|C|RHS|RW)\]/);
  });
});

describe("readOpponent ranking", () => {
  it("puts the pocket between their lines ahead of the room behind their strikers", () => {
    const f = FORMATIONS.find((x) => x.id === "11-4-4-2")!;
    const opp = f.slots.map((slot) => ({ kind: "opponent" as const, group: "Opponent", ...compress(slot, "away") }));
    const labels = readOpponent(opp, getPitch("full")).exploits.map((e) => e.label);
    expect(labels[0]).toMatch(/^Pocket/);
  });
});
