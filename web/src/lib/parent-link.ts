/**
 * Parent-link codes: the credential an adult uses to prove they are entitled
 * to a child's records.
 *
 * Deliberately NOT part of the access-code family in `access-codes.ts`. Those
 * three (academy join, team coach, team invite) are shared, permanent,
 * unlimited-use codes, which is correct for "join this squad" — a coach can
 * see the roster and remove a stranger. It is the wrong shape for the only
 * gate on a child's blood type, allergies, home address and emergency
 * contacts: one leaked WhatsApp message would permanently entitle an
 * unbounded number of adults.
 *
 * These are issued per child by a coach or admin, single-use, expiring,
 * revocable, and stored hashed. They are also 10 characters rather than 6, so
 * a parent who pastes one into the club-code box on the register form gets a
 * useful error instead of a confusing one.
 */

/**
 * Mirrors the database side's own
 * `regexp_replace(upper(coalesce(p_code,'')), '[^A-Z0-9]', '', 'g')`. This is
 * the client-side copy of that rule, not a replacement for it — the RPC
 * normalises independently, because a client can send anything.
 */
export function normalizeParentLinkCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** 5 random bytes as hex. 16^10 ≈ 1.1e12, against 16^6 ≈ 16.7M for a club code. */
export const PARENT_LINK_CODE_LENGTH = 10;

export function isCompleteParentLinkCode(raw: string): boolean {
  return normalizeParentLinkCode(raw).length === PARENT_LINK_CODE_LENGTH;
}

/**
 * Display form: `7F3A2-9C1B4`. The hyphen is presentation only — it is
 * stripped by `normalizeParentLinkCode` on the way back in — and exists so a
 * 10-character child-link code is visibly not a 6-character club code.
 */
export function formatParentLinkCode(raw: string): string {
  const normalized = normalizeParentLinkCode(raw);
  if (normalized.length !== PARENT_LINK_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

/**
 * True when a code is the length of a club/team code rather than a child-link
 * code. Used to tell someone pasting into the wrong box what they have, rather
 * than "invalid code".
 */
export function looksLikeAccessCode(raw: string): boolean {
  return normalizeParentLinkCode(raw).length === 6;
}

export interface RedeemParentLinkResult {
  success?: boolean;
  error?: string;
  child_name?: string;
  player_id?: string;
}

export interface ParentLinkCodeSummary {
  id: string;
  code_last4: string;
  relationship: string | null;
  issued_by_name: string | null;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by_name: string | null;
  revoked_at: string | null;
  status: "live" | "redeemed" | "revoked" | "expired";
}

/**
 * True when the parent-link RPCs are absent because migration 032 has not been
 * run against this project yet. PostgREST answers `PGRST202` for a function it
 * cannot find.
 *
 * Migrations in this repo are checked in but never applied automatically (see
 * web/CLAUDE.md), so there is a real window where the UI is deployed and the
 * functions are not. Callers must fail CLOSED on this — never fall back to the
 * old direct insert, which is the vulnerability being closed.
 */
export function isMissingParentLinkRpc(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "PGRST202";
}

export const MISSING_PARENT_LINK_RPC_MESSAGE =
  "Linking a child is temporarily unavailable — an administrator needs to run " +
  "migration 032. Ask your child's coach to link you in the meantime.";

/**
 * True when a column added by migration 032 is not in the database yet.
 * `42703` is Postgres' undefined_column; `PGRST204` is PostgREST's write-side
 * equivalent. Same reasoning as `isMissingAttributeColumn` in attributes.ts: a
 * wide SELECT naming a missing column fails outright rather than returning the
 * columns that do exist, so it reads as "no data" instead of as an error.
 */
export function isMissingParentLinkColumn(
  error: { code?: string } | null | undefined
): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}
