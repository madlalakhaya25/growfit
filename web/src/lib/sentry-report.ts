// Sends server-side error reports to Sentry over its plain HTTP envelope API,
// with no SDK. Every reportError call site is on the server, so an SDK's
// browser bundle, source-map upload and build wrapper would add weight and
// build risk for nothing; this is a few dozen lines, and it stays off until a
// DSN is set (lib/report-error.ts).
//
// POPIA: the academy holds children's personal information, and a report is a
// copy of application state sent to a third party. `scrubText` therefore strips
// the shapes personal data takes inside an error message (an email, a long
// number such as an ID, a phone number or a registration number, and the
// "Key (column)=(value)" detail Postgres puts in a constraint error) before
// anything leaves the app, in addition to the key-based redaction of `extra`.

export interface ParsedDsn { key: string; host: string; projectId: string; protocol: string }

/** `https://<key>@<host>/<project>` to its parts, or null for anything else. */
export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, "");
    if (!u.username || !projectId || !/^https?:$/.test(u.protocol)) return null;
    return { key: u.username, host: u.host, projectId, protocol: u.protocol };
  } catch {
    return null;
  }
}

const MAX_TEXT = 500;

/** Removes the shapes personal data takes in an error message, and caps its length. */
export function scrubText(text: string): string {
  return text
    .replace(/Key \([^)]*\)=\([^)]*\)/gi, "Key [redacted]")
    .replace(/[\w.+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,5}/g, "[email]")
    .replace(/\+?\d(?:[ -]?\d){5,}/g, "[number]")
    .slice(0, MAX_TEXT);
}

export interface ReportPayload {
  severity: string;
  scope: string;
  message: string;
  stack?: string;
  extra?: Record<string, unknown>;
  at: string;
}

/** One Sentry envelope: header line, item header line, event line. */
export function buildEnvelope(payload: ReportPayload, dsn: string, eventId: string, environment: string): string {
  const message = scrubText(payload.message);
  const event = {
    event_id: eventId,
    timestamp: payload.at,
    platform: "node",
    level: payload.severity === "warning" ? "warning" : "error",
    logger: "growfit",
    environment,
    message,
    // One issue per place and message, however the stack differs between builds.
    fingerprint: [payload.scope, message],
    tags: { scope: payload.scope },
    extra: { ...payload.extra, stack: payload.stack ? scrubText(payload.stack) : undefined },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: payload.at, dsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

const eventId = () => crypto.randomUUID().replaceAll("-", "");

/**
 * Fire and forget. Never throws and never waits for Sentry: an error report must
 * not slow down or break the request it is about. Uses Next's `after` when it is
 * running inside a request, so a serverless function is kept alive long enough
 * to send; outside a request it just sends.
 */
export function sendToSentry(payload: ReportPayload, dsn: string | undefined = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN): void {
  const parsed = parseDsn(dsn);
  if (!parsed || !dsn) return;
  const url = `${parsed.protocol}//${parsed.host}/api/${parsed.projectId}/envelope/`;
  const send = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-sentry-envelope",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=growfit/1.0`,
    },
    body: buildEnvelope(payload, dsn, eventId(), process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "production"),
  }).then(() => undefined, () => undefined);
  void import("next/server").then(({ after }) => { try { after(send); } catch { /* not in a request */ } }, () => undefined);
}
