import { sentryOptions } from "../sentry-options";
import { scrubEvent } from "../sentry-scrub";

describe("sentryOptions", () => {
  it("is off without a DSN and on with one", () => {
    expect(sentryOptions(undefined).enabled).toBe(false);
    expect(sentryOptions("").enabled).toBe(false);
    expect(sentryOptions("https://k@o1.ingest.de.sentry.io/2").enabled).toBe(true);
  });
  it("never sends default personal data and always scrubs before sending", () => {
    const o = sentryOptions("https://k@o1.ingest.de.sentry.io/2");
    expect(o.sendDefaultPii).toBe(false);
    expect(o.beforeSend).toBe(scrubEvent);
  });
});
