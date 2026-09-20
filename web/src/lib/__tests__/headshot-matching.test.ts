import { attachHeadshotsByIdentity, type MatchablePlayer } from "@/lib/headshot-matching";
import type { CardHeadshot } from "@/lib/pdf-headshots";

/**
 * Regression coverage for the bug that took three rounds to actually fix on
 * a real academy import: matching a card's photo to its player by POSITION
 * in a list, rather than by the registration number printed on the card
 * itself. A single card with no readable photo shifted every photo after it
 * one player up — confidently putting the wrong child's face on a name.
 *
 * These synthetic labels stand in for what pdf-headshots.ts reads off a real
 * card — no PDF needed to prove the matching rule itself holds.
 */

function player(overrides: Partial<MatchablePlayer> & { full_name: string }): MatchablePlayer {
  return { fifa_number: null, mysafa_number: null, id_number: null, photoDataUrl: null, ...overrides };
}

function headshot(dataUrl: string, ...labels: string[]): CardHeadshot {
  return { dataUrl, labels };
}

describe("attachHeadshotsByIdentity", () => {
  it("binds a photo to its player by FIFA number, regardless of list order", () => {
    // Deliberately out of step with the players array — position must not matter.
    const headshots = [
      headshot("photo-b.jpg", "MHLONGO", "ESIHLE", "1CJHP74"),
      headshot("photo-a.jpg", "NGIDI", "ANELISA", "1P7BXZ7"),
    ];
    const players = [
      player({ full_name: "Anelisa Ngidi", fifa_number: "1P7BXZ7" }),
      player({ full_name: "Esihle Mhlongo", fifa_number: "1CJHP74" }),
    ];

    const unclaimed = attachHeadshotsByIdentity(players, headshots);

    expect(players[0].photoDataUrl).toBe("photo-a.jpg");
    expect(players[1].photoDataUrl).toBe("photo-b.jpg");
    expect(unclaimed).toEqual([]);
  });

  it("does not shift photos onto the wrong player when one card's photo is missing", () => {
    // This is the exact failure mode that shipped: Cibane's photo never
    // extracted (corrupted card), and everyone after her in the list used
    // to inherit the next person's photo.
    const headshots = [
      headshot("ngidi.jpg", "NGIDI", "1P7BXZ7"),
      // Cibane's card has no extractable photo — no entry for her at all.
      headshot("mthembu.jpg", "MTHEMBU", "1QXM7V5"),
    ];
    const players = [
      player({ full_name: "Anelisa Ngidi", fifa_number: "1P7BXZ7" }),
      player({ full_name: "Sinakhukuphila Cibane", fifa_number: "1QVJ7V5" }),
      player({ full_name: "Nqubeko Mthembu", fifa_number: "1QXM7V5" }),
    ];

    attachHeadshotsByIdentity(players, headshots);

    expect(players[0].photoDataUrl).toBe("ngidi.jpg");
    expect(players[1].photoDataUrl).toBeNull(); // Cibane: no guess, no photo.
    expect(players[2].photoDataUrl).toBe("mthembu.jpg"); // Not ngidi's neighbour's photo.
  });

  it("falls back to distinctive name tokens when registration numbers don't read cleanly", () => {
    const headshots = [headshot("photo.jpg", "ASANELE", "NDUZI")];
    const players = [player({ full_name: "Asanele Nduzi" })]; // no numbers on this card

    attachHeadshotsByIdentity(players, headshots);

    expect(players[0].photoDataUrl).toBe("photo.jpg");
  });

  it("never guesses when a photo's identity matches more than one player", () => {
    const headshots = [headshot("ambiguous.jpg", "0Q9M9")];
    const players = [
      player({ full_name: "Player One", mysafa_number: "0Q9M9" }),
      player({ full_name: "Player Two", mysafa_number: "0Q9M9" }), // duplicate on the sheet
    ];

    const unclaimed = attachHeadshotsByIdentity(players, headshots);

    expect(players[0].photoDataUrl).toBeNull();
    expect(players[1].photoDataUrl).toBeNull();
    expect(unclaimed).toEqual(["ambiguous.jpg"]);
  });

  it("reports a photo as unclaimed rather than dropping it when no player matches", () => {
    const headshots = [headshot("orphan.jpg", "UNKNOWN123")];
    const players = [player({ full_name: "Someone Else", fifa_number: "1AAAAAA" })];

    const unclaimed = attachHeadshotsByIdentity(players, headshots);

    expect(players[0].photoDataUrl).toBeNull();
    expect(unclaimed).toEqual(["orphan.jpg"]);
  });

  it("does nothing when the document had no extractable headshots at all", () => {
    const players = [player({ full_name: "Someone", fifa_number: "1AAAAAA" })];
    const unclaimed = attachHeadshotsByIdentity(players, []);
    expect(unclaimed).toEqual([]);
    expect(players[0].photoDataUrl).toBeNull();
  });
});
