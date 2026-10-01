/** @jest-environment node */
import { NextRequest } from "next/server";

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
const mockRequireUser = jest.fn();
jest.mock("@/lib/auth", () => ({ requireUser: (...a: unknown[]) => mockRequireUser(...a) }));
const mockBuildCtx = jest.fn();
jest.mock("@/lib/ai-tools/context", () => ({ buildAgentContext: (...a: unknown[]) => mockBuildCtx(...a) }));
const mockFeatures = jest.fn();
jest.mock("@/lib/features", () => ({ getAcademyFeatures: (...a: unknown[]) => mockFeatures(...a) }));
const mockBudget = jest.fn();
jest.mock("@/lib/ai-guard", () => ({
  checkAiBudget: (...a: unknown[]) => mockBudget(...a),
  aiError: () => "friendly",
}));
const mockExecute = jest.fn();
jest.mock("@/lib/ai-tools", () => ({
  executeTool: (...a: unknown[]) => mockExecute(...a),
  toolDeclarations: () => [],
  TOOL_LABELS: {},
}));
const mockStream = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { generateContentStream: (...a: unknown[]) => mockStream(...a) }; },
}));

import { GET, POST } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/agent", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

async function* chunks(...parts: object[][]) {
  for (const p of parts) yield { candidates: [{ content: { parts: p } }] };
}

describe("/api/agent", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockBuildCtx.mockResolvedValue({ userId: "u1", role: "coach", academyId: "a", teamIds: [], teams: [] });
    mockBudget.mockResolvedValue(null);
    mockFeatures.mockResolvedValue({ tactics: true, film: true, assistant: true, agent: true });
  });

  it("answers 403 when the academy has switched the agent off, before spending budget", async () => {
    mockFeatures.mockResolvedValue({ tactics: true, film: true, assistant: true, agent: false });
    const res = await POST(req({ question: "hi" }));
    expect(res.status).toBe(403);
    expect(mockBudget).not.toHaveBeenCalled();
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("GET redirects an unauthenticated caller (requireUser) and is otherwise 405", async () => {
    mockRequireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
    mockRequireUser.mockResolvedValue({});
    expect((await GET()).status).toBe(405);
  });

  it("POST answers 401 when signed out and 403 for non-staff", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({ question: "hi" }))).status).toBe(401);
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockBuildCtx.mockResolvedValue(null);
    expect((await POST(req({ question: "hi" }))).status).toBe(403);
  });

  it("rejects a bad body before spending any budget", async () => {
    const res = await POST(req({ question: "" }));
    expect(res.status).toBe(400);
    expect(mockBudget).not.toHaveBeenCalled();
  });

  it("returns 429 when over budget", async () => {
    mockBudget.mockResolvedValue("slow down");
    const res = await POST(req({ question: "hi" }));
    expect(res.status).toBe(429);
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("streams SSE and consumes the budget once for a two-round turn", async () => {
    mockStream
      .mockResolvedValueOnce(chunks([{ functionCall: { name: "getSquad", args: {} } }]))
      .mockResolvedValueOnce(chunks([{ text: "Two " }], [{ text: "players." }]));
    mockExecute.mockResolvedValue({ ok: true, data: { players: [] }, links: [{ label: "A", href: "/dashboard/coach/squad/a" }] });

    const res = await POST(req({ question: "how many?" }));
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();

    expect(mockBudget).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenCalledWith(expect.anything(), "getSquad", {});
    expect(text).toContain('event: tool');
    expect(text).toContain('"delta":"Two "');
    expect(text).toContain('event: links');
    expect(text.trim().endsWith('"type":"done"}')).toBe(true);

    // Tool declarations were offered on round 1 and automatic calling is off.
    expect(mockStream.mock.calls[0][0].config.tools).toBeDefined();
    expect(mockStream.mock.calls[0][0].config.automaticFunctionCalling).toEqual({ disable: true });
  });

  it("never leaks provider error text", async () => {
    mockStream.mockRejectedValue(new Error("secret provider detail"));
    const text = await (await POST(req({ question: "hi" }))).text();
    expect(text).toContain('"message":"friendly"');
    expect(text).not.toContain("secret");
  });
});
