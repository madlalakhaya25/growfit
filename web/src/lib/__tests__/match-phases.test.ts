import { cleanPhaseRatings, phaseHighlights, ratedPhases, MATCH_PHASES } from "../match-phases";

describe("cleanPhaseRatings", () => {
  it("keeps known phases rated 1 to 5", () => {
    expect(cleanPhaseRatings({ in_possession: 4, set_pieces: 1 })).toEqual({ in_possession: 4, set_pieces: 1 });
  });

  it("drops unknown phases, out-of-range and non-whole values", () => {
    expect(cleanPhaseRatings({ in_possession: 6, out_of_possession: 0, set_pieces: 2.5, shooting: 3, attacking_transition: "4" })).toBeNull();
    expect(cleanPhaseRatings({ in_possession: 5, shooting: 3 })).toEqual({ in_possession: 5 });
  });

  it("returns null for nothing worth storing", () => {
    expect(cleanPhaseRatings(null)).toBeNull();
    expect(cleanPhaseRatings({})).toBeNull();
    expect(cleanPhaseRatings([3, 4])).toBeNull();
    expect(cleanPhaseRatings("in_possession")).toBeNull();
  });
});

describe("ratedPhases", () => {
  it("lists rated phases in the fixed order, whatever order they were stored in", () => {
    expect(ratedPhases({ set_pieces: 2, in_possession: 4 }).map((p) => p.id)).toEqual(["in_possession", "set_pieces"]);
    expect(ratedPhases(null)).toEqual([]);
  });

  it("covers the four moments of the game plus set pieces", () => {
    expect(MATCH_PHASES).toHaveLength(5);
  });
});

describe("phaseHighlights", () => {
  it("names the strongest and weakest phase", () => {
    expect(phaseHighlights({ in_possession: 4, out_of_possession: 2, set_pieces: 3 })).toEqual({
      best: "In possession",
      worst: "Out of possession",
    });
  });

  it("says nothing when there is no difference to point at", () => {
    expect(phaseHighlights({ in_possession: 3 })).toBeNull();
    expect(phaseHighlights({ in_possession: 3, set_pieces: 3 })).toBeNull();
  });
});
