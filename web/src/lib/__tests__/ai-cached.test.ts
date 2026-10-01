import { generateOrServeText } from "../ai-cached";
import { fakeSupabase, type FakeOp } from "@/test-utils/fake-supabase";

jest.mock("../report-error", () => ({ reportError: jest.fn() }));

const base = {
  kind: "player_insights" as const,
  subjectType: "player" as const,
  subjectId: "p1",
  academyId: "ac-1",
  userId: "u1",
  brief: "the brief",
  modelId: "gemini-x",
};

function store(opts: { live?: () => Record<string, unknown>[]; missingTable?: boolean } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const ops: FakeOp[] = [];
  const f = fakeSupabase((op) => {
    ops.push(op);
    if (opts.missingTable) return { error: { code: "PGRST205", message: "no table" } };
    if (op.action === "select") return { data: opts.live ? opts.live() : [] };
    if (op.action === "update") return { data: null };
    const row = { id: `a${inserted.length + 1}`, created_at: new Date().toISOString(), superseded_at: null, ...op.payload };
    inserted.push(row);
    return { data: row };
  });
  return { client: f.client, inserted, ops };
}

describe("generateOrServeText", () => {
  it("generates and saves on a miss, with tokens and the fingerprint", async () => {
    const s = store();
    const generate = jest.fn().mockResolvedValue({
      text: "An insight.",
      response: { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } },
    });
    const r = await generateOrServeText(s.client as never, { ...base, generate });

    expect(r).toMatchObject({ text: "An insight.", cached: false, persisted: true, artefactId: "a1", feedback: null });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(s.inserted[0]).toMatchObject({
      kind: "player_insights", subject_id: "p1", model_id: "gemini-x", prose: "An insight.",
      prompt_tokens: 10, output_tokens: 20, total_tokens: 30, status: "draft", created_by: "u1",
    });
    expect(s.inserted[0].inputs_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a hit returns the stored text with NO model call and NO budget check", async () => {
    const first = store();
    await generateOrServeText(first.client as never, { ...base, generate: async () => ({ text: "Stored." }) });
    const live = [first.inserted[0]];

    const generate = jest.fn();
    const beforeGenerate = jest.fn().mockResolvedValue(null);
    const second = store({ live: () => live });
    const r = await generateOrServeText(second.client as never, { ...base, generate, beforeGenerate });

    expect(r).toMatchObject({ text: "Stored.", cached: true, artefactId: "a1" });
    expect(generate).not.toHaveBeenCalled();
    expect(beforeGenerate).not.toHaveBeenCalled();
    expect(second.inserted).toHaveLength(0);
  });

  it.each([
    ["the brief changed", { brief: "a different brief" }],
    ["the model changed", { modelId: "gemini-y" }],
    ["force was passed", { force: true }],
  ])("a stored answer is NOT served when %s", async (_n, override) => {
    const first = store();
    await generateOrServeText(first.client as never, { ...base, generate: async () => ({ text: "Stored." }) });
    const generate = jest.fn().mockResolvedValue({ text: "Fresh." });
    const r = await generateOrServeText(store({ live: () => [first.inserted[0]] }).client as never, { ...base, ...override, generate });
    expect(r.cached).toBe(false);
    expect(r.text).toBe("Fresh.");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("a refusal from beforeGenerate (over budget) stops before the model and returns the message", async () => {
    const generate = jest.fn();
    const s = store();
    const r = await generateOrServeText(s.client as never, { ...base, generate, beforeGenerate: async () => "Too many requests." });
    expect(r).toEqual({ error: "Too many requests." });
    expect(generate).not.toHaveBeenCalled();
    expect(s.inserted).toHaveLength(0);
  });

  it("with migration 045 missing, still returns the answer, flagged as not persisted", async () => {
    const generate = jest.fn().mockResolvedValue({ text: "Unsaved." });
    const r = await generateOrServeText(store({ missingTable: true }).client as never, { ...base, generate });
    expect(r).toMatchObject({ text: "Unsaved.", cached: false, persisted: false });
    expect(r.artefactId).toBeUndefined();
  });

  it("a failure inside the model call propagates to the caller's own catch", async () => {
    await expect(
      generateOrServeText(store().client as never, { ...base, generate: async () => { throw new Error("boom"); } })
    ).rejects.toThrow("boom");
  });

  it("falls back to data.text when prose is absent on a stored row", async () => {
    const first = store();
    await generateOrServeText(first.client as never, { ...base, generate: async () => ({ text: "Stored." }) });
    const row = { ...first.inserted[0], prose: null };
    const r = await generateOrServeText(store({ live: () => [row] }).client as never, { ...base, generate: jest.fn() });
    expect(r.text).toBe("Stored.");
  });
});
