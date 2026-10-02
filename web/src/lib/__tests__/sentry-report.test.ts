import { buildEnvelope, parseDsn, scrubText, sendToSentry } from "../sentry-report";

const DSN = "https://abc123@o1.ingest.sentry.io/456";
const payload = { severity: "error", scope: "approveFamilyMessage", message: "boom", stack: "Error: boom\n at x", extra: { teamId: "t1" }, at: "2026-10-05T10:00:00.000Z" };

describe("parseDsn", () => {
  it("reads key, host and project", () => {
    expect(parseDsn(DSN)).toEqual({ key: "abc123", host: "o1.ingest.sentry.io", projectId: "456", protocol: "https:" });
  });
  it("rejects anything that is not a usable DSN", () => {
    for (const bad of [undefined, "", "not a url", "https://o1.ingest.sentry.io/456", "https://abc@o1.ingest.sentry.io/", "ftp://abc@h/1"]) {
      expect(parseDsn(bad)).toBeNull();
    }
  });
});

describe("scrubText", () => {
  it("strips emails, long numbers and Postgres key details, and caps length", () => {
    expect(scrubText("Parent a.b@example.com failed")).toBe("Parent [email] failed");
    expect(scrubText("ID 0001015800086 and phone 082 123 4567")).toBe("ID [number] and phone [number]");
    expect(scrubText('duplicate key value violates unique constraint "x" Key (id_number)=(0001015800086) already exists')).not.toMatch(/0001015800086|id_number/);
    expect(scrubText("x".repeat(900))).toHaveLength(500);
  });
  it("leaves ordinary diagnostics alone", () => {
    expect(scrubText("relation family_messages does not exist (42P01)")).toBe("relation family_messages does not exist (42P01)");
  });
});

describe("buildEnvelope", () => {
  it("is three JSON lines: envelope header, item header, event", () => {
    const [h, i, e] = buildEnvelope(payload, DSN, "e".repeat(32), "production").split("\n").map((l) => JSON.parse(l));
    expect(h).toMatchObject({ event_id: "e".repeat(32), dsn: DSN });
    expect(i).toEqual({ type: "event" });
    expect(e).toMatchObject({ level: "error", logger: "growfit", environment: "production", message: "boom", tags: { scope: "approveFamilyMessage" }, fingerprint: ["approveFamilyMessage", "boom"] });
    expect(e.extra).toMatchObject({ teamId: "t1" });
  });
  it("scrubs the message and the stack, and maps warning level", () => {
    const env = buildEnvelope({ ...payload, severity: "warning", message: "bad 0001015800086", stack: "at 0001015800086" }, DSN, "e".repeat(32), "preview");
    expect(env).not.toContain("0001015800086");
    expect(JSON.parse(env.split("\n")[2]).level).toBe("warning");
  });
});

describe("sendToSentry", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it("sends nothing without a usable DSN", () => {
    const f = jest.fn().mockResolvedValue({});
    globalThis.fetch = f as never;
    sendToSentry(payload, undefined);
    sendToSentry(payload, "nonsense");
    expect(f).not.toHaveBeenCalled();
  });

  it("posts an envelope to the project's envelope URL with the key", () => {
    const f = jest.fn().mockResolvedValue({});
    globalThis.fetch = f as never;
    sendToSentry(payload, DSN);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://o1.ingest.sentry.io/api/456/envelope/");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Sentry-Auth"]).toContain("sentry_key=abc123");
    expect(init.body.split("\n")).toHaveLength(3);
  });

  it("never throws or rejects when Sentry is unreachable", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("offline")) as never;
    expect(() => sendToSentry(payload, DSN)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
