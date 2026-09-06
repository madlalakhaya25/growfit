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
