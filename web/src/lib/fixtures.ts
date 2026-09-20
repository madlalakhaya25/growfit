import type { FixtureStatus } from "@/lib/types";

/**
 * Whether a fixture belongs in "Past" rather than "Upcoming".
 *
 * `status` alone isn't enough — a coach doesn't log a result the moment the
 * final whistle blows, so a fixture that kicked off yesterday can sit at
 * "upcoming" in the database for days. Once kickoff has passed, it's past
 * regardless of whether the result has been logged yet.
 *
 * "postponed" is the one exception: it has no future date of its own until
 * the coach reschedules it, so it stays in "Upcoming" rather than falling
 * into "Past" the moment its original (now-stale) date elapses.
 */
export function isFixturePast(fixture: { status: string | FixtureStatus; fixture_date: string }): boolean {
  if (fixture.status === "completed" || fixture.status === "cancelled") return true;
  if (fixture.status === "postponed") return false;
  return new Date(fixture.fixture_date).getTime() < Date.now();
}

export type FixtureBadgeVariant = "neutral" | "success" | "danger" | "warning";

/**
 * Display label for a fixture's status badge. A fixture whose kickoff has
 * passed but whose result hasn't been logged yet is still "upcoming" in the
 * database (see isFixturePast) — showing that literally reads as a bug once
 * the fixture has already moved into "Past", so it's relabelled here to
 * describe what's actually true: nobody has recorded what happened yet.
 */
export function fixtureStatusLabel(fixture: { status: string; fixture_date: string }): string {
  if (fixture.status === "upcoming" && isFixturePast(fixture)) return "Result pending";
  return fixture.status;
}

/** Badge colour to pair with fixtureStatusLabel — pending pairs with warning, not neutral, since it wants a coach to act. */
export function fixtureStatusVariant(fixture: { status: string; fixture_date: string }): FixtureBadgeVariant {
  if (fixture.status === "upcoming" && isFixturePast(fixture)) return "warning";
  if (fixture.status === "completed") return "success";
  if (fixture.status === "cancelled") return "danger";
  if (fixture.status === "postponed") return "warning";
  return "neutral";
}
