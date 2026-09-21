import {
  checkRateLimit,
  isRateLimitShared,
  __resetRateLimitMemory,
} from "../rate-limit";

describe("in-memory backend (no Upstash credentials)", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __resetRateLimitMemory();
  });
  afterAll(() => {
    if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("reports no shared store configured", () => {
    expect(isRateLimitShared()).toBe(false);
  });

  it("allows calls under the limit", async () => {
    const result = await checkRateLimit({ key: "test:a", windowMs: 60_000, max: 3 });
    expect(result.allowed).toBe(true);
  });

  it("blocks once the max is reached, and reports a retry time", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit({ key: "test:b", windowMs: 60_000, max: 3 })).allowed).toBe(true);
    }
    const blocked = await checkRateLimit({ key: "test:b", windowMs: 60_000, max: 3 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("keeps separate counters per key", async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit({ key: "test:c1", windowMs: 60_000, max: 3 });
    // A different key must not be affected by test:c1's exhausted budget.
    expect((await checkRateLimit({ key: "test:c2", windowMs: 60_000, max: 3 })).allowed).toBe(true);
  });

  it("resets after the window elapses", async () => {
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 2; i++) await checkRateLimit({ key: "test:d", windowMs: 1000, max: 2 });
      expect((await checkRateLimit({ key: "test:d", windowMs: 1000, max: 2 })).allowed).toBe(false);
      jest.advanceTimersByTime(1001);
      expect((await checkRateLimit({ key: "test:d", windowMs: 1000, max: 2 })).allowed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Upstash backend (mocked — no real Upstash instance in this environment)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("reports a shared store as configured", () => {
    expect(isRateLimitShared()).toBe(true);
  });

  it("sends a pipelined INCR/PEXPIRE-NX/PTTL request with the auth header", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 1 }, { result: 1 }, { result: 60_000 }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await checkRateLimit({ key: "auth:1.2.3.4", windowMs: 60_000, max: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.upstash.io/pipeline");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body[0]).toEqual(["INCR", "ratelimit:auth:1.2.3.4"]);
    expect(body[1]).toEqual(["PEXPIRE", "ratelimit:auth:1.2.3.4", "60000", "NX"]);
    expect(body[2]).toEqual(["PTTL", "ratelimit:auth:1.2.3.4"]);
  });

  it("allows when the INCR result is at or under max", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 5 }, { result: 0 }, { result: 30_000 }],
    }) as unknown as typeof fetch;

    const result = await checkRateLimit({ key: "auth:x", windowMs: 60_000, max: 10 });
    expect(result.allowed).toBe(true);
  });

  it("blocks when the INCR result exceeds max, using PTTL as retryAfterMs", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 11 }, { result: 0 }, { result: 42_000 }],
    }) as unknown as typeof fetch;

    const result = await checkRateLimit({ key: "auth:y", windowMs: 60_000, max: 10 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(42_000);
  });

  it("falls back to the full window when PTTL is missing or negative", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 11 }, { result: 0 }, { result: -1 }],
    }) as unknown as typeof fetch;

    const result = await checkRateLimit({ key: "auth:z", windowMs: 60_000, max: 10 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60_000);
  });

  it("fails open — allows the request — when Upstash returns a non-OK response", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    // A broken rate limiter must not lock out every login attempt just
    // because its own dependency had a bad moment.
    const result = await checkRateLimit({ key: "auth:down", windowMs: 60_000, max: 10 });
    expect(result.allowed).toBe(true);

    logSpy.mockRestore();
  });

  it("fails open when fetch itself throws (network error)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkRateLimit({ key: "auth:offline", windowMs: 60_000, max: 10 });
    expect(result.allowed).toBe(true);

    logSpy.mockRestore();
  });

  it("fails open when Upstash reports a command error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: null, error: "WRONGTYPE" }, { result: 0 }, { result: -1 }],
    }) as unknown as typeof fetch;
    const logSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkRateLimit({ key: "auth:badtype", windowMs: 60_000, max: 10 });
    expect(result.allowed).toBe(true);

    logSpy.mockRestore();
  });
});
