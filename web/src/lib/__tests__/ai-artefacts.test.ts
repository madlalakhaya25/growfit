import {
  AI_ARTEFACT_TTL,
  deleteAiArtefactsForSubject,
  deleteAgeRewritesMentioning,
  deletePlayRolesForPlayer,
  fingerprintBrief,
  getLatestAiArtefact,
  isCacheHit,
  isMissingAiArtefactsTable,
  mapArtefactRow,
  readUsage,
  saveAiArtefact,
  summariseAiUsage,
} from "../ai-artefacts";
import { isMissingAttributeColumn } from "../attributes";

const NOW = new Date("2026-10-10T12:00:00Z");
const fresh = {
  kind: "development_plan" as const,
  modelId: "gemini-x",
  inputsFingerprint: "abc",
  supersededAt: null,
  createdAt: "2026-10-09T12:00:00Z",
};
const want = { modelId: "gemini-x", inputsFingerprint: "abc" };

describe("isCacheHit — each of the documented conditions failing independently", () => {
  it("hits when everything matches", () => {
    expect(isCacheHit(fresh, want, NOW)).toBe(true);
  });
  it("misses when superseded", () => {
    expect(isCacheHit({ ...fresh, supersededAt: "2026-10-09T13:00:00Z" }, want, NOW)).toBe(false);
  });
  it("misses when the brief changed (fingerprint)", () => {
    expect(isCacheHit(fresh, { ...want, inputsFingerprint: "different" }, NOW)).toBe(false);
  });
  it("misses when the configured model changed", () => {
    expect(isCacheHit(fresh, { ...want, modelId: "gemini-y" }, NOW)).toBe(false);
  });
  it("misses once outside the kind's window, and hits just inside it", () => {
    const edge = new Date(NOW.getTime() - AI_ARTEFACT_TTL.development_plan);
    expect(isCacheHit({ ...fresh, createdAt: edge.toISOString() }, want, NOW)).toBe(true);
    expect(isCacheHit({ ...fresh, createdAt: new Date(edge.getTime() - 1).toISOString() }, want, NOW)).toBe(false);
  });
  it("uses a per-kind window", () => {
    const twoDaysAgo = "2026-10-08T11:00:00Z";
    expect(isCacheHit({ ...fresh, createdAt: twoDaysAgo }, want, NOW)).toBe(true); // plan: 28d
    expect(isCacheHit({ ...fresh, kind: "academy_health", createdAt: twoDaysAgo }, want, NOW)).toBe(false); // 24h
  });
  it("treats an unparseable timestamp as a miss, not a hit", () => {
    expect(isCacheHit({ ...fresh, createdAt: "not a date" }, want, NOW)).toBe(false);
  });
});

describe("fingerprintBrief", () => {
  it("is stable and sensitive to the text", () => {
    expect(fingerprintBrief("brief")).toBe(fingerprintBrief("brief"));
    expect(fingerprintBrief("brief")).not.toBe(fingerprintBrief("brief "));
    expect(fingerprintBrief("brief")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("readUsage", () => {
  it("reads genai's usageMetadata field names", () => {
    expect(
      readUsage({
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, thoughtsTokenCount: 3, totalTokenCount: 33 },
      })
    ).toEqual({ prompt: 10, output: 20, thinking: 3, total: 33 });
  });
  it("returns all-null rather than throwing on any other shape", () => {
    const empty = { prompt: null, output: null, thinking: null, total: null };
    expect(readUsage(undefined)).toEqual(empty);
    expect(readUsage(null)).toEqual(empty);
    expect(readUsage({})).toEqual(empty);
    expect(readUsage({ usageMetadata: "nope" })).toEqual(empty);
    expect(readUsage({ usageMetadata: { promptTokenCount: "10", totalTokenCount: NaN } })).toEqual(empty);
  });
});

describe("isMissingAiArtefactsTable", () => {
  it("catches the TABLE codes", () => {
    expect(isMissingAiArtefactsTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingAiArtefactsTable({ code: "42P01" })).toBe(true);
  });
  it("does not catch other errors", () => {
    expect(isMissingAiArtefactsTable({ code: "42501" })).toBe(false);
    expect(isMissingAiArtefactsTable(null)).toBe(false);
    expect(isMissingAiArtefactsTable(undefined)).toBe(false);
  });
  it("is genuinely distinct from the column helper — the reason it exists", () => {
    expect(isMissingAttributeColumn({ code: "PGRST205" })).toBe(false);
    expect(isMissingAttributeColumn({ code: "42P01" })).toBe(false);
    expect(isMissingAiArtefactsTable({ code: "PGRST204" })).toBe(false);
    expect(isMissingAiArtefactsTable({ code: "42703" })).toBe(false);
  });
});

describe("mapArtefactRow", () => {
  it("maps snake_case to the typed shape and nulls absent optionals", () => {
    const a = mapArtefactRow<{ x: number }>({
      id: "1", kind: "development_plan", subject_type: "player", subject_id: "p", data: { x: 1 },
      model_id: "m", inputs_fingerprint: "f", status: "draft", created_by: "u", created_at: "t",
      prompt_tokens: 5,
    });
    expect(a.data).toEqual({ x: 1 });
    expect(a.tokens).toEqual({ prompt: 5, output: null, thinking: null, total: null });
    expect(a.prose).toBeNull();
    expect(a.approvedByName).toBeNull();
    expect(a.feedback).toBeNull();
    expect(a.supersededAt).toBeNull();
  });
});

/**
 * A minimal chainable stand-in for the Supabase query builder that resolves
 * to a fixed result. Not a network mock of this app's own logic -- it only
 * lets us prove the "table is absent" and "other error" branches, which can't
 * be reached without a database that lacks migration 045.
 */
function stubClient(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_t, prop) {
      if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...result });
      return () => self;
    },
  });
  return { from: () => self } as never;
}

describe("graceful degradation when migration 045 is not applied", () => {
  const missing = stubClient({ error: { code: "PGRST205", message: "no table" } });

  it("getLatestAiArtefact returns available:false and never throws", async () => {
    await expect(
      getLatestAiArtefact(missing, { kind: "development_plan", subjectType: "player", subjectId: "p" })
    ).resolves.toEqual({ artefact: null, available: false });
  });

  it("saveAiArtefact reports persisted:false without an error", async () => {
    const r = await saveAiArtefact(missing, {
      kind: "development_plan", subjectType: "player", subjectId: "p", academyId: "a", createdBy: "u",
      data: {}, modelId: "m", inputsFingerprint: "f",
    });
    expect(r).toEqual({ artefact: null, persisted: false });
  });

  it("summariseAiUsage reports available:false with a null (not zero) summary", async () => {
    await expect(summariseAiUsage(missing, { academyId: "a", since: "2026-10-01" })).resolves.toEqual({
      summary: null, available: false,
    });
  });

  it("erasure is not blocked by the missing table", async () => {
    await expect(deleteAiArtefactsForSubject(missing, { subjectType: "player", subjectId: "p" })).resolves.toEqual({
      deleted: true,
    });
  });

  it("a different error is surfaced as an error, but still never throws", async () => {
    const other = stubClient({ error: { code: "42501", message: "denied" } });
    const r = await getLatestAiArtefact(other, { kind: "development_plan", subjectType: "player", subjectId: "p" });
    expect(r.artefact).toBeNull();
    expect(r.available).toBe(true);
    expect(r.error).toBe("denied");
    await expect(deleteAiArtefactsForSubject(other, { subjectType: "player", subjectId: "p" })).resolves.toEqual({
      deleted: false, error: "denied",
    });
  });
});

describe("summariseAiUsage aggregation", () => {
  it("counts calls, sums tokens, tallies feedback, and keeps null tokens null", async () => {
    const client = stubClient({
      data: [
        { kind: "development_plan", total_tokens: 100, feedback: "helpful" },
        { kind: "development_plan", total_tokens: 50, feedback: "not_helpful" },
        { kind: "academy_health", total_tokens: null, feedback: null },
      ],
    });
    const { summary } = await summariseAiUsage(client, { academyId: "a", since: "2026-10-01" });
    expect(summary).toEqual({
      calls: 3,
      totalTokens: 150,
      helpful: 1,
      notHelpful: 1,
      byKind: [
        { kind: "development_plan", calls: 2, totalTokens: 150 },
        { kind: "academy_health", calls: 1, totalTokens: null },
      ],
    });
  });
  it("totalTokens stays null when no row carried any", async () => {
    const client = stubClient({ data: [{ kind: "academy_health", total_tokens: null, feedback: null }] });
    const { summary } = await summariseAiUsage(client, { academyId: "a", since: "2026-10-01" });
    expect(summary?.totalTokens).toBeNull();
  });
});

describe("deletePlayRolesForPlayer", () => {
  function recording(reply: { error?: { code?: string; message?: string } | null } = {}) {
    const calls: [string, ...unknown[]][] = [];
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: null, error: reply.error ?? null });
        return (...args: unknown[]) => { calls.push([prop, ...args]); return chain; };
      },
    });
    return { calls, client: { from: (t: string) => { calls.push(["from", t]); return chain; } } as never };
  }

  it("deletes only the play_roles sets whose entries include the player", async () => {
    const r = recording();
    await expect(deletePlayRolesForPlayer(r.client, "p-1")).resolves.toEqual({ deleted: true });
    expect(r.calls).toEqual([
      ["from", "ai_artefacts"],
      ["delete"],
      ["eq", "kind", "play_roles"],
      ["contains", "data", { roles: [{ playerId: "p-1" }] }],
    ]);
  });
  it("is not blocked by the missing table, and surfaces any other error", async () => {
    await expect(deletePlayRolesForPlayer(recording({ error: { code: "PGRST205", message: "no table" } }).client, "p")).resolves.toEqual({ deleted: true });
    await expect(deletePlayRolesForPlayer(recording({ error: { code: "42501", message: "denied" } }).client, "p")).resolves.toEqual({
      deleted: false, error: "denied",
    });
  });
});

describe("deleteAgeRewritesMentioning", () => {
  function recording(reply: { error?: { code?: string; message?: string } | null } = {}) {
    const calls: [string, ...unknown[]][] = [];
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: null, error: reply.error ?? null });
        return (...args: unknown[]) => { calls.push([prop, ...args]); return chain; };
      },
    });
    return { calls, client: { from: (t: string) => { calls.push(["from", t]); return chain; } } as never };
  }

  it("deletes this academy's rewrites that mention the full name or the first name", async () => {
    const r = recording();
    await expect(deleteAgeRewritesMentioning(r.client, "ac", "Sipho Dlamini")).resolves.toEqual({ deleted: true });
    expect(r.calls).toEqual([
      ["from", "ai_artefacts"], ["delete"], ["eq", "academy_id", "ac"], ["eq", "kind", "age_rewrite"], ["ilike", "prose", "%Sipho Dlamini%"],
      ["from", "ai_artefacts"], ["delete"], ["eq", "academy_id", "ac"], ["eq", "kind", "age_rewrite"], ["ilike", "prose", "%Sipho%"],
    ]);
  });
  it("escapes LIKE wildcards so a name cannot match everything", async () => {
    const r = recording();
    await deleteAgeRewritesMentioning(r.client, "ac", "100%_x");
    expect(r.calls.filter((c) => c[0] === "ilike")).toEqual([["ilike", "prose", "%100\\%\\_x%"]]);
  });
  it("is not blocked by the missing table, and surfaces any other error", async () => {
    await expect(deleteAgeRewritesMentioning(recording({ error: { code: "42P01" } }).client, "ac", "A B")).resolves.toEqual({ deleted: true });
    await expect(deleteAgeRewritesMentioning(recording({ error: { code: "42501", message: "denied" } }).client, "ac", "A B")).resolves.toEqual({
      deleted: false, error: "denied",
    });
  });
});
