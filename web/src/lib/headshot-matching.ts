import type { CardHeadshot } from "@/lib/pdf-headshots";

export interface MatchablePlayer {
  full_name: string;
  fifa_number: string | null;
  mysafa_number: string | null;
  id_number: string | null;
  photoDataUrl: string | null;
}

/**
 * Bind each extracted headshot to the player whose card it was printed on,
 * by matching the registration numbers read off that same card — never by
 * position in a list.
 *
 * Position was tried and abandoned: a single card with a missing or
 * unreadable photo shifts every photo after it one player up, silently
 * putting the wrong child's face on a name. Registration numbers (FIFA
 * Connect ID, MySAFA) are unique per player and printed on the card right
 * under the photo, so they identify the owner outright.
 *
 * A match is only accepted when it is unambiguous in both directions — one
 * photo, one player. Anything ambiguous is left for the reviewer instead of
 * being guessed at, and the count of such photos is returned so the caller
 * can say so plainly.
 *
 * Mutates `players` in place; returns the photos left unclaimed, so the
 * reviewer can place them by hand rather than having them silently binned.
 */
export function attachHeadshotsByIdentity<T extends MatchablePlayer>(
  players: T[],
  headshots: CardHeadshot[]
): string[] {
  if (headshots.length === 0) return [];
  const key = (v: string | null) => (v ? v.replace(/\s/g, "").toUpperCase() : null);
  const claimed = new Set<number>();

  // A registration number shared by more than one player on this document is
  // a data problem upstream (a duplicate), not something to guess through —
  // binding on it risks handing one player's photo to a different child.
  // Excluding it here is what makes "unambiguous in both directions" actually
  // true, rather than only checking the photo side.
  const idCounts = new Map<string, number>();
  for (const p of players) {
    for (const k of [key(p.fifa_number), key(p.mysafa_number), key(p.id_number)]) {
      if (k && k.length >= 3) idCounts.set(k, (idCounts.get(k) ?? 0) + 1);
    }
  }

  const bind = (identifiers: (string | null)[], player: T, uniquePerPlayer: boolean): boolean => {
    const keys = identifiers
      .map(key)
      .filter((k): k is string => !!k && k.length >= 3 && (!uniquePerPlayer || idCounts.get(k) === 1));
    if (keys.length === 0) return false;
    const hits: number[] = [];
    for (const [i, h] of headshots.entries()) {
      if (claimed.has(i)) continue;
      if (keys.some((k) => h.labels.includes(k))) hits.push(i);
    }
    // Ambiguous in either direction is not a match — leave it to the reviewer.
    if (hits.length !== 1) return false;
    claimed.add(hits[0]);
    player.photoDataUrl = headshots[hits[0]].dataUrl;
    return true;
  };

  // Registration numbers first: unique by definition, so these are exact —
  // unless this document has the same number on two different players.
  const stillNeedingPhoto = players.filter(
    (p) => !bind([p.fifa_number, p.mysafa_number, p.id_number], p, true)
  );

  // Then names, for a card whose numbers didn't read cleanly. Only distinctive
  // parts — a short token risks colliding with another player's name.
  for (const p of stillNeedingPhoto) {
    bind(p.full_name.split(/\s+/).filter((w) => w.length >= 4), p, false);
  }

  return headshots.filter((_, i) => !claimed.has(i)).map((h) => h.dataUrl);
}
