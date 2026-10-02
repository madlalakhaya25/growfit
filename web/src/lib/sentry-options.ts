// One set of Sentry options shared by the server, edge and browser configs, so
// the privacy rules cannot drift between them. The SDK stays off until a DSN is
// set, and personal data is stripped in `beforeSend` (lib/sentry-scrub.ts).
//
// Deliberately NOT enabled: session replay (it records what is on screen, which
// here is children's names, medical details and photos) and default PII (IP
// addresses, cookies, headers).

import { scrubEvent } from "@/lib/sentry-scrub";

export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "production",
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
    beforeSend: scrubEvent,
  };
}
