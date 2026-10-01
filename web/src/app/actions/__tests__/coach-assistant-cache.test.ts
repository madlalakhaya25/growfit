jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/lib/report-error", () => ({ reportError: jest.fn() }));
jest.mock("@/lib/auth", () => ({ requireUser: async () => ({ user: { id: "u1" }, supabase: {} }) }));
jest.mock("@/lib/ai-guard", () => ({ checkAiBudget: async () => null, aiError: () => "friendly" }));
jest.mock("@/lib/assistant-context", () => ({ getAssistantContext: jest.fn() }));
const mockBuild = jest.fn();
jest.mock("../squad-context", () => ({ buildSquadContext: (...a: unknown[]) => mockBuild(...a) }));
const mockCreate = jest.fn();
const mockGenerate = jest.fn();
jest.mock("@google/genai", () => ({
  Type: {},
  GoogleGenAI: class {
    caches = { create: (...a: unknown[]) => mockCreate(...a) };
    models = { generateContent: (...a: unknown[]) => mockGenerate(...a) };
  },
}));

import { askCoachAssistant } from "../coach-assistant";

const ctx = (n: number) => ({
  teamName: "U13", ageGroup: "U13", academyId: "ac", teamId: "t1", playerCount: 12,
  // A different stable brief per test, so one test's cache can't serve the next.
  stableBrief: `ROSTER ${n}`, volatileBrief: "STATUS", brief: `ROSTER ${n}\n\nSTATUS`,
});
let n = 0;
const ask = () => askCoachAssistant({ teamId: "t1", history: [], question: "who is low?" });
const sentText = (call: number) =>
  JSON.stringify(mockGenerate.mock.calls[call][0].contents);

beforeEach(() => {
  jest.clearAllMocks();
  mockBuild.mockResolvedValue({ context: ctx(++n) });
  process.env.GEMINI_API_KEY = "k";
});

describe("askCoachAssistant context caching", () => {
  it("references the cache by name and withholds the stable brief and the system prompt", async () => {
    mockCreate.mockResolvedValue({ name: "cachedContents/1" });
    mockGenerate.mockResolvedValue({ text: "Sipho." });
    expect(await ask()).toEqual({ answer: "Sipho." });
    const req = mockGenerate.mock.calls[0][0];
    expect(req.config.cachedContent).toBe("cachedContents/1");
    expect(req.config.systemInstruction).toBeUndefined();
    expect(sentText(0)).not.toContain(`ROSTER ${n}`);
    expect(sentText(0)).toContain("STATUS");
  });

  it("goes inline, with the system prompt, when a cache can't be created", async () => {
    mockCreate.mockRejectedValue(new Error("below minimum token count"));
    mockGenerate.mockResolvedValue({ text: "Sipho." });
    expect(await ask()).toEqual({ answer: "Sipho." });
    const req = mockGenerate.mock.calls[0][0];
    expect(req.config.cachedContent).toBeUndefined();
    expect(req.config.systemInstruction).toEqual(expect.any(String));
    expect(sentText(0)).toContain(`ROSTER ${n}`);
  });

  it("retries once inline when the server has dropped the cache", async () => {
    mockCreate.mockResolvedValue({ name: "cachedContents/gone" });
    mockGenerate
      .mockRejectedValueOnce(new Error("CachedContent not found (or permission denied)"))
      .mockResolvedValueOnce({ text: "Sipho." });
    expect(await ask()).toEqual({ answer: "Sipho." });
    expect(mockGenerate).toHaveBeenCalledTimes(2);
    expect(mockGenerate.mock.calls[1][0].config.cachedContent).toBeUndefined();
    expect(sentText(1)).toContain(`ROSTER ${n}`);
  });

  it("does not retry a quota failure, and shows only the friendly message", async () => {
    mockCreate.mockResolvedValue({ name: "cachedContents/2" });
    mockGenerate.mockRejectedValue(new Error("429 RESOURCE_EXHAUSTED"));
    expect(await ask()).toEqual({ error: "friendly" });
    expect(mockGenerate).toHaveBeenCalledTimes(1);
  });
});
