import {
  isErrorReportingConfigured,
  redactContext,
  reportError,
} from "../report-error";

describe("isErrorReportingConfigured", () => {
  const originalSentry = process.env.SENTRY_DSN;
  const originalPublicSentry = process.env.NEXT_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (originalSentry === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalSentry;
    if (originalPublicSentry === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = originalPublicSentry;
  });

  it("is false with no DSN configured — today's actual state", () => {
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    expect(isErrorReportingConfigured()).toBe(false);
  });

  it("is true once a server DSN is set", () => {
    process.env.SENTRY_DSN = "https://example.ingest.sentry.io/1";
    expect(isErrorReportingConfigured()).toBe(true);
  });

  it("is true once a public DSN is set", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example.ingest.sentry.io/1";
    expect(isErrorReportingConfigured()).toBe(true);
  });
});

describe("redactContext", () => {
  it("redacts keys that look like personal data a POPIA-governed academy holds", () => {
    const redacted = redactContext({
      id_number: "0001010000000",
      mysafa_number: "SA12345",
      medical_notes: "asthma",
      phone_number: "0821234567",
      home_address: "1 Test St",
      date_of_birth: "2015-01-01",
      teamId: "44444444-4444-4444-4444-444444444444",
    });
    expect(redacted?.id_number).toBe("[redacted]");
    expect(redacted?.mysafa_number).toBe("[redacted]");
    expect(redacted?.medical_notes).toBe("[redacted]");
    expect(redacted?.phone_number).toBe("[redacted]");
    expect(redacted?.home_address).toBe("[redacted]");
    expect(redacted?.date_of_birth).toBe("[redacted]");
  });

  it("leaves ordinary diagnostic context alone", () => {
    const redacted = redactContext({ teamId: "abc", query: "player_attributes" });
    expect(redacted).toEqual({ teamId: "abc", query: "player_attributes" });
  });

  it("passes through undefined", () => {
    expect(redactContext(undefined)).toBeUndefined();
  });
});

describe("reportError", () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => logSpy.mockRestore());

  it("never throws, even given a hostile input", () => {
    expect(() => reportError(undefined, { scope: "test" })).not.toThrow();
    expect(() => reportError(null, { scope: "test" })).not.toThrow();
    expect(() => reportError("a bare string", { scope: "test" })).not.toThrow();
    expect(() => reportError({ circular: {} as unknown }, { scope: "test" })).not.toThrow();
  });

  it("logs something identifiable by scope", () => {
    reportError(new Error("boom"), { scope: "test scope" });
    expect(logSpy).toHaveBeenCalled();
    const logged = logSpy.mock.calls[0].join(" ");
    expect(logged).toContain("test scope");
    expect(logged).toContain("boom");
  });

  it("redacts extra context before logging", () => {
    reportError(new Error("boom"), {
      scope: "test",
      extra: { id_number: "0001010000000" },
    });
    const logged = logSpy.mock.calls[0].join(" ");
    expect(logged).not.toContain("0001010000000");
    expect(logged).toContain("[redacted]");
  });

  it("carries a Postgres/PostgREST-shaped error's code and message", () => {
    reportError({ code: "42501", message: "permission denied" }, { scope: "test" });
    const logged = logSpy.mock.calls[0].join(" ");
    expect(logged).toContain("42501");
    expect(logged).toContain("permission denied");
  });
});
