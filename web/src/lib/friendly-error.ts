/**
 * Turns a raw Postgres/PostgREST/Supabase error into something a coach or
 * parent can actually act on.
 *
 * Every server action in this app has been doing `return { error:
 * error.message }`, which is whatever Postgres or PostgREST happened to say —
 * "duplicate key value violates unique constraint
 * \"team_members_pkey\"", "new row violates row-level security policy for
 * table \"player_medical\"", a bare "JWT expired". None of that means
 * anything to the person reading it, and some of it (constraint and table
 * names) is more detail than a non-technical user needs.
 *
 * `friendlyError()` recognises the codes and message shapes that actually
 * show up in this app — RLS denials, unique/foreign-key/check violations, the
 * missing-column signals already handled ad hoc in attributes.ts and
 * parent-link.ts, session expiry, and network failure — and returns plain
 * language for each. Anything it doesn't recognise falls back to a generic
 * message (customisable per call site) rather than surfacing raw internals;
 * the original error is always still `console.error`-logged so it's not lost
 * for debugging.
 */

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

/**
 * Postgres SQLSTATE / PostgREST codes this app actually produces. Not an
 * exhaustive list of every code Postgres can emit — just the ones a real
 * error here can plausibly carry, per the app's own schema and RLS.
 */
const CODE_MESSAGES: Record<string, string> = {
  // RLS denial — the row exists but the policy said no, or the caller tried
  // to write something outside their academy/role.
  "42501": "You don't have permission to do that.",
  // unique_violation — e.g. a duplicate share code, a second rating for the
  // same fixture from the same coach.
  "23505": "That already exists.",
  // foreign_key_violation — the thing this points at (a fixture, a team, a
  // player) has since been removed.
  "23503": "That no longer exists — try refreshing the page.",
  // check_violation — a value outside what the column allows (e.g. an
  // attribute rating outside 1–99).
  "23514": "That value isn't allowed.",
  // not_null_violation — a required field was left out.
  "23502": "A required field is missing.",
  // undefined_column, and PostgREST's write-side equivalent — a migration
  // hasn't been applied yet. Same signal isMissingAttributeColumn() and
  // isMissingParentLinkColumn() check for individually; this is the general
  // form for any table.
  "42703": "This feature isn't fully set up yet. Please contact your administrator.",
  PGRST204: "This feature isn't fully set up yet. Please contact your administrator.",
  // PostgREST couldn't find the function at all — a newer migration adding
  // an RPC hasn't been applied.
  PGRST202: "This feature isn't available yet. Please contact your administrator.",
  // .single() got zero or more than one row back.
  PGRST116: "Couldn't find that. It may have been removed or already changed.",
  // Expired/invalid JWT.
  PGRST301: "Your session has expired. Please sign in again.",
};

/** Matched against `error.message` when there's no usable `code`. */
const MESSAGE_PATTERNS: [RegExp, string][] = [
  [/JWT expired/i, "Your session has expired. Please sign in again."],
  [/JWT/i, "Your session has expired. Please sign in again."],
  [/row-level security/i, "You don't have permission to do that."],
  [/Failed to fetch|NetworkError|ECONNREFUSED/i, "Couldn't connect. Check your internet connection and try again."],
];

/**
 * @param error Whatever a Supabase call's `.error` came back as, or a caught
 *   exception. Untyped on purpose — this is meant to be the last thing
 *   standing between raw Postgres output and a user's screen, so it has to
 *   accept whatever actually shows up.
 * @param fallback Shown when nothing above matches. Keep this specific to
 *   what the caller was doing ("Couldn't save your rating.") rather than the
 *   generic default, wherever the call site knows the context.
 */
export function friendlyError(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (!error) return fallback;

  if (typeof error === "object") {
    const err = error as PostgrestLikeError;
    if (err.code && CODE_MESSAGES[err.code]) {
      return CODE_MESSAGES[err.code];
    }
    if (typeof err.message === "string") {
      for (const [pattern, message] of MESSAGE_PATTERNS) {
        if (pattern.test(err.message)) return message;
      }
    }
  }

  // Logged, not shown — this is exactly the raw detail a user shouldn't see,
  // but it needs to be somewhere for whoever investigates next.
  console.error("[friendlyError] unrecognised error:", error);
  return fallback;
}
