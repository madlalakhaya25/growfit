import { AGENT_TOOLS, executeTool, toolDeclarations, TOOL_LABELS } from "..";
import { makeCtx } from "@/test-utils/agent-tools";

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/app/actions/welfare", () => ({ getWelfareAlerts: jest.fn() }));

describe("registry", () => {
  it("has unique tool names, each with a label, declaration and positive row cap", () => {
    const names = AGENT_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of AGENT_TOOLS) {
      expect(TOOL_LABELS[t.name]).toBeTruthy();
      expect(t.maxRows).toBeGreaterThan(0);
      expect(t.maxRows).toBeLessThanOrEqual(50);
    }
    expect(toolDeclarations().map((d) => d.name)).toEqual(names);
  });

  it("exposes no emergency-contact, medical or ID tool", () => {
    expect(AGENT_TOOLS.map((t) => t.name).join(" ")).not.toMatch(/emergency|medical|contact|idNumber|safa/i);
  });

  it("returns a rejection, never a throw, for an unknown tool or malformed args", async () => {
    const { ctx } = makeCtx(() => ({ data: [] }));
    expect(await executeTool(ctx, "dropTables", {})).toEqual({ ok: false, error: expect.any(String) });
    for (const t of AGENT_TOOLS) {
      await expect(executeTool(ctx, t.name, "not an object")).resolves.toMatchObject({ ok: false });
    }
  });

  it("hides database error text from the model", async () => {
    const { ctx } = makeCtx(() => ({ error: { message: "secret relation detail" } }));
    const res = await executeTool(ctx, "getSquad", {});
    expect(res).toEqual({ ok: false, error: expect.not.stringContaining("secret") });
  });

  it("returns data and links on success", async () => {
    const { ctx } = makeCtx(() => ({ data: [] }));
    expect(await executeTool(ctx, "getSquad", {})).toEqual({ ok: true, data: { players: [], truncated: false }, links: [] });
  });
});
