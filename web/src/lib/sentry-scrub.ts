// Strips personal data from an event before it leaves the app for Sentry.
//
// POPIA: the academy holds children's personal information, and an error event
// is a copy of application state sent to a third party. `scrubText` removes the
// shapes personal data takes inside a message or stack (an email, a long number
// such as an ID, a phone number or a registration number, and the
// "Key (column)=(value)" detail Postgres puts in a constraint error), and
// `scrubEvent` applies it to everything text-shaped on an SDK event and drops
// the request body, cookies and headers entirely. It runs in `beforeSend` on the
// server, the edge and the browser (lib/sentry-options.ts).

const MAX_TEXT = 500;

/** Removes the shapes personal data takes in an error message, and caps its length. */
export function scrubText(text: string): string {
  return text
    .replace(/Key \([^)]*\)=\([^)]*\)/gi, "Key [redacted]")
    .replace(/[\w.+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,5}/g, "[email]")
    .replace(/\+?\d(?:[ -]?\d){5,}/g, "[number]")
    .slice(0, MAX_TEXT);
}

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v)]));
  }
  return value;
}

/** The parts of a Sentry event that can carry text; anything else passes through untouched. */
interface ScrubbableEvent {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  extra?: Record<string, unknown>;
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown> }>;
  request?: { data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown; url?: string };
  user?: unknown;
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const out: T = { ...event };
  if (out.message) out.message = scrubText(out.message);
  if (out.exception?.values) {
    out.exception = { ...out.exception, values: out.exception.values.map((v) => (v.value ? { ...v, value: scrubText(v.value) } : v)) };
  }
  if (out.extra) out.extra = scrubValue(out.extra) as Record<string, unknown>;
  if (out.breadcrumbs) {
    out.breadcrumbs = out.breadcrumbs.map((b) => ({
      ...b,
      message: b.message ? scrubText(b.message) : b.message,
      data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
    }));
  }
  if (out.request) {
    const { data: _d, cookies: _c, headers: _h, query_string: _q, ...rest } = out.request;
    out.request = rest;
  }
  delete out.user;
  return out;
}
