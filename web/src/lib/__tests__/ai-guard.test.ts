import { aiError, checkAiBudget, __resetAiBudget } from "../ai-guard";

describe("aiError", () => {
  const originalKey = process.env.GEMINI_API_KEY;
  let logged: jest.SpyInstance;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    logged = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    logged.mockRestore();
  });

  it("never returns the provider's own message", () => {
    // The exact shape that used to reach a coach's screen: an SDK error
    // carrying the endpoint and model id.
    const raw =
      "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [429] Quota exceeded for project 12345";
    const shown = aiError(new Error(raw));
    expect(shown).not.toContain("googleapis.com");
    expect(shown).not.toContain("gemini-3.6-flash");
    expect(shown).not.toContain("12345");
  });

  it("still logs the original so it isn't lost", () => {
    const err = new Error("fetch failed");
    aiError(err);
    expect(logged).toHaveBeenCalledWith("[ai]", err);
  });

  it("names the remedy for a quota failure", () => {
    expect(aiError(new Error("[429] RESOURCE_EXHAUSTED: quota"))).toMatch(/quota/i);
  });

  it("names the remedy for a retired model, the failure that broke every feature once", () => {
    expect(aiError(new Error("models/x is not found for API version v1beta"))).toMatch(/GEMINI_MODEL/);
  });

  it("points at configuration when no key is set at all", () => {
    delete process.env.GEMINI_API_KEY;
    expect(aiError(new Error("anything"))).toMatch(/aren't configured/i);
  });

  it("falls back generically for an unrecognised failure", () => {
    expect(aiError(new Error("something entirely new"))).toMatch(/unavailable/i);
  });

  it("handles a non-Error throw without crashing", () => {
    expect(typeof aiError("a bare string")).toBe("string");
  });
});

describe("checkAiBudget", () => {
  beforeEach(() => __resetAiBudget());

  it("allows calls under the budget", async () => {
    expect(await checkAiBudget("coach-1")).toBeNull();
    expect(await checkAiBudget("coach-1")).toBeNull();
  });

  it("blocks once the hourly budget is spent, and says when to retry", async () => {
    for (let i = 0; i < 60; i++) expect(await checkAiBudget("coach-2")).toBeNull();
    const blocked = await checkAiBudget("coach-2");
    expect(blocked).toMatch(/try again in \d+ minute/i);
  });

  it("budgets each user separately", async () => {
    for (let i = 0; i < 60; i++) await checkAiBudget("coach-3");
    expect(await checkAiBudget("coach-3")).not.toBeNull();
    expect(await checkAiBudget("coach-4")).toBeNull();
  });
});
