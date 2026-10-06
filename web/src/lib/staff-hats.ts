// Staff "hats" (docs/FEATURE_SPECS/role-dashboards-and-curriculum.md, Part 2):
// an optional title on a staff member that only chooses which cards appear on
// their Today page. A hat grants no data access. Pure, so Jest can load it.

export const STAFF_HATS = [
  "director",
  "technical_director",
  "safeguarding",
  "finance",
  "fundraising",
  "registration",
  "equipment",
] as const;

export type StaffHat = (typeof STAFF_HATS)[number];

export const HAT_LABELS: Record<StaffHat, string> = {
  director: "Academy director",
  technical_director: "Technical director",
  safeguarding: "Safeguarding",
  finance: "Finance",
  fundraising: "Fundraising",
  registration: "Registration",
  equipment: "Equipment",
};

export function isStaffHat(value: unknown): value is StaffHat {
  return typeof value === "string" && (STAFF_HATS as readonly string[]).includes(value);
}

/** Known hats only, each once, in the fixed display order. Anything else is dropped. */
export function cleanHats(raw: unknown): StaffHat[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter(isStaffHat));
  return STAFF_HATS.filter((h) => wanted.has(h));
}

/** The cards on the admin Today page. Core cards show for everyone. */
export type AdminCard =
  | "registration" | "welfare" | "fixtures" | "objectives" | "coverage" | "sessions" | "stats" | "quick_actions";

const ADMIN_CARD_HATS: Record<AdminCard, readonly StaffHat[] | "core"> = {
  registration: ["director", "registration"],
  welfare: ["director", "safeguarding"],
  fixtures: ["director"],
  objectives: ["director", "technical_director"],
  coverage: ["technical_director"],
  sessions: ["technical_director"],
  stats: ["director", "technical_director", "finance", "fundraising"],
  quick_actions: "core",
};

export const ADMIN_CARDS = Object.keys(ADMIN_CARD_HATS) as AdminCard[];

/**
 * Which admin cards to show. No hats (or hats not read yet, or the table not
 * there) shows every card, exactly as before hats existed. With hats, a card
 * shows when any of the person's hats wants it, and core cards always show.
 */
export function adminCardsFor(hats: readonly StaffHat[]): AdminCard[] {
  if (hats.length === 0) return [...ADMIN_CARDS];
  return ADMIN_CARDS.filter((card) => {
    const wanted = ADMIN_CARD_HATS[card];
    return wanted === "core" || wanted.some((h) => hats.includes(h));
  });
}
