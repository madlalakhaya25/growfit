// How long after its start time a training session still counts as "on".
// Today's "Next training" card used to ask for sessions starting after now, so
// a session fell off the coach's home screen the minute it began, the moment
// the coach most wanted it. Training runs about 90 minutes; three hours leaves
// room for a late start without keeping yesterday's session pinned.
export const SESSION_WINDOW_MS = 3 * 60 * 60 * 1000;

/** ISO instant before which a session no longer counts as current. */
export function sessionWindowStart(nowMs: number): string {
  return new Date(nowMs - SESSION_WINDOW_MS).toISOString();
}

/** Started, and still inside its window. */
export function isHappeningNow(sessionDate: string, nowMs: number): boolean {
  const start = new Date(sessionDate).getTime();
  return start <= nowMs && nowMs < start + SESSION_WINDOW_MS;
}
