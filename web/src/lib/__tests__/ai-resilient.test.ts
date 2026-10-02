import type { GoogleGenAI } from "@google/genai";
import { generateWithRetry, isModelBusy } from "../ai-resilient";

const busy = Object.assign(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}'), { status: 503 });

function fakeAi(generateContent: jest.Mock) {
  return { models: { generateContent } } as unknown as GoogleGenAI;
}

describe("generateWithRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.GEMINI_MODEL_FALLBACK;
  });
  afterEach(() => jest.useRealTimers());

  it("retries a busy model and returns the first success", async () => {
    const gen = jest.fn().mockRejectedValueOnce(busy).mockRejectedValueOnce(busy).mockResolvedValue({ text: "ok" });
    const p = generateWithRetry(fakeAi(gen), { model: "m", contents: "x" });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toEqual({ text: "ok" });
    expect(gen).toHaveBeenCalledTimes(3);
  });

  it("does not retry an error that would fail the same way again", async () => {
    const gen = jest.fn().mockRejectedValue(new Error("API key not valid"));
    await expect(generateWithRetry(fakeAi(gen), { model: "m", contents: "x" })).rejects.toThrow("API key");
    expect(gen).toHaveBeenCalledTimes(1);
  });

  it("gives up with the busy error after three tries when no fallback is set", async () => {
    const gen = jest.fn().mockRejectedValue(busy);
    const p = generateWithRetry(fakeAi(gen), { model: "m", contents: "x" }).catch((e) => e);
    await jest.runAllTimersAsync();
    expect(await p).toBe(busy);
    expect(gen).toHaveBeenCalledTimes(3);
  });

  it("makes a last attempt on GEMINI_MODEL_FALLBACK", async () => {
    process.env.GEMINI_MODEL_FALLBACK = "backup";
    const gen = jest.fn().mockImplementation(async (p: { model: string }) => {
      if (p.model === "backup") return { text: "from backup" };
      throw busy;
    });
    const p = generateWithRetry(fakeAi(gen), { model: "m", contents: "x" });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toEqual({ text: "from backup" });
    expect(gen).toHaveBeenLastCalledWith({ model: "backup", contents: "x" });
  });
});

describe("isModelBusy", () => {
  it("recognises Google's overload answer and nothing else", () => {
    expect(isModelBusy(busy)).toBe(true);
    expect(isModelBusy(new Error("This model is currently experiencing high demand"))).toBe(true);
    expect(isModelBusy(new Error("429 RESOURCE_EXHAUSTED quota"))).toBe(false);
  });
});
