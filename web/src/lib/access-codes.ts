/**
 * One normalisation rule for every access code (academy join code, team
 * coach code, team invite code) — all three are 6-character codes redeemed
 * through `redeem_access_code` / `peek_access_code`.
 *
 * Before this, four call sites each normalised a little differently:
 *   - squad.ts uppercased with no trim at all, so a pasted trailing
 *     newline failed to match.
 *   - auth/role/page.tsx checked `length !== 6` against a `maxLength={6}`
 *     input, so pasting " ABC123" (7 chars, one a leading space) silently
 *     truncated to "ABC12" — 5 chars — and read as "wrong length" rather
 *     than "trim it and it's fine".
 *   - Only register/page.tsx stripped non-alphanumerics correctly.
 * The database side (`redeem_access_code`) does its own
 * `upper(regexp_replace(code, '\s', '', 'g'))` independently — this is the
 * client-side mirror of the same rule, not a replacement for it.
 */
export function normalizeAccessCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const ACCESS_CODE_LENGTH = 6;

export function isCompleteAccessCode(raw: string): boolean {
  return normalizeAccessCode(raw).length === ACCESS_CODE_LENGTH;
}

export type AccessCodeKind = "team_coach" | "team_player" | "academy";

export interface PeekAccessCodeResult {
  valid: boolean;
  kind?: AccessCodeKind;
  label?: string;
}

export interface RedeemAccessCodeResult {
  success?: boolean;
  error?: string;
  kind?: AccessCodeKind;
  team_name?: string;
  academy_name?: string;
  already?: boolean;
  is_head?: boolean;
}

/** Human label for what a code kind actually grants, used in confirmation UI. */
export function describeAccessCodeKind(kind: AccessCodeKind | undefined): string {
  switch (kind) {
    case "team_coach":
      return "a coach seat on a team";
    case "team_player":
      return "a squad";
    case "academy":
      return "an academy";
    default:
      return "something";
  }
}
