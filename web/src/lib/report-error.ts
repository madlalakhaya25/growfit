/**
 * One place errors go, so a swallowed failure has somewhere to be seen.
 *
 * Three separate fixes in September were "make a swallowed error visible",
 * and all three made it visible by writing to `console.error` — which on
 * Vercel means a function log nobody at a grassroots academy reads. The
 * fourth silent failure would have been found the same way: by a coach
 * mentioning it weeks later.
 *
 * This is the seam, not the service. It works today (structured console
 * output, which is at least greppable and consistent), and it starts
 * shipping to a real error tracker the moment a DSN exists — no call site
 * changes. That matters because wiring ~40 call sites is the expensive part,
 * and it should not be blocked on someone creating an account.
 *
 * ## Turning on a real tracker
 *
 * 1. `npm i @sentry/nextjs` in `web/`
 * 2. Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser)
 * 3. Replace the body of `deliver()` below with `Sentry.captureException`
 *
 * Nothing else in the app needs touching. Until step 2, `isErrorReportingConfigured()`
 * is false and this degrades to the console output it replaces.
 */

export type ErrorSeverity = "error" | "warning";

export interface ErrorContext {
  /** Where this happened, e.g. "squad page" or "markTrainingAttendance". */
  scope: string;
  /** Anything that helps diagnose it. Never put personal data here. */
  extra?: Record<string, unknown>;
  severity?: ErrorSeverity;
}

/**
 * Whether a real tracker is configured.
 *
 * Exported so a settings or health page can tell an admin that errors are
 * currently going nowhere but a log — which is worth knowing, and is the
 * state the app is in today.
 */
export function isErrorReportingConfigured(): boolean {
  return Boolean(
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN
  );
}

/**
 * Keys whose values are never included in a report.
 *
 * The academy holds children's ID numbers, medical information and contact
 * details under POPIA. An error report is a copy of application state sent
 * to a third party, so the safe default is to drop anything whose key looks
 * personal rather than to rely on call sites remembering.
 */
const REDACT_KEYS =
  /(^|_)(id_number|mysafa|medical|allerg|condition|medication|phone|email|address|dob|date_of_birth|password|token|secret|key)(_|$)/i;

export function redactContext(
  extra: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    out[key] = REDACT_KEYS.test(key) ? "[redacted]" : value;
  }
  return out;
}

/** Narrow an unknown throw to something loggable without losing a stack. */
function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (error && typeof error === "object") {
    // Supabase/PostgREST errors are plain objects with code/message/details.
    const e = error as { message?: string; code?: string; details?: string };
    return {
      message: [e.code, e.message, e.details].filter(Boolean).join(" · ") || JSON.stringify(error),
    };
  }
  return { message: String(error) };
}

function deliver(payload: Record<string, unknown>) {
  // Replace with `Sentry.captureException` once a DSN exists — see the note
  // at the top of this file.
  console.error("[growfit:error]", JSON.stringify(payload));
}

/**
 * Report an error.
 *
 * Deliberately never throws: a failure inside error reporting must not
 * become a second, louder failure in the request that was already going
 * wrong.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  try {
    const { message, stack } = describe(error);
    deliver({
      severity: context.severity ?? "error",
      scope: context.scope,
      message,
      stack,
      extra: redactContext(context.extra),
      at: new Date().toISOString(),
    });
  } catch {
    // Last resort — never let reporting break the caller.
  }
}
