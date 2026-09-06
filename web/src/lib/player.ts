/**
 * Small, pure derived-data rules about a player that were each being
 * re-decided independently in a dozen-plus files — age from a birthdate in
 * 12 places, initials from a name in 11. Not a data-access concern (the
 * query stays wherever it already was); this is just the one place either
 * judgment call gets made, so a fix to it is a fix everywhere at once.
 */

const MS_PER_YEAR = 31_557_600_000; // 365.25 days — matches leap years on average

/** Age in whole years from a YYYY-MM-DD (or any Date-parseable) birthdate. */
export function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / MS_PER_YEAR);
}

/** Up to two initials from a full name, e.g. "Anelisa Ngidi" → "AN". */
export function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
