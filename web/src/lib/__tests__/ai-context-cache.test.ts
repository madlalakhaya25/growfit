import {
  CONTEXT_CACHE_NEGATIVE_MS,
  CONTEXT_CACHE_TTL_SECONDS,
  createContextCacheManager,
  isStaleCacheError,
} from "../ai-context-cache";

const input = { key: "acad:team:abc", model: "m1", systemInstruction: "sys", contents: [{ role: "user" }] };

function setup(create: jest.Mock) {
  let t = 1_000_000;
  const mgr = createContextCacheManager({ caches: { create }, now: () => t });
  return { mgr, advance: (ms: number) => { t += ms; } };
}

describe("context cache manager", () => {
  it("creates once, then serves the same name until near expiry", async () => {
    const create = jest.fn().mockResolvedValue({ name: "cachedContents/1" });
    const { mgr, advance } = setup(create);
    expect(await mgr.get(input)).toBe("cachedContents/1");
    expect(await mgr.get(input)).toBe("cachedContents/1");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      model: "m1",
      config: { systemInstruction: "sys", ttl: `${CONTEXT_CACHE_TTL_SECONDS}s` },
    });
    advance((CONTEXT_CACHE_TTL_SECONDS - 100) * 1000); // inside the refresh margin
    create.mockResolvedValue({ name: "cachedContents/2" });
    expect(await mgr.get(input)).toBe("cachedContents/2");
  });

  it("keys on model as well as content", async () => {
    const create = jest.fn().mockResolvedValueOnce({ name: "a" }).mockResolvedValueOnce({ name: "b" });
    const { mgr } = setup(create);
    expect(await mgr.get(input)).toBe("a");
    expect(await mgr.get({ ...input, model: "m2" })).toBe("b");
  });

  it("deduplicates concurrent creates", async () => {
    let resolve!: (v: { name: string }) => void;
    const create = jest.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { mgr } = setup(create);
    const both = Promise.all([mgr.get(input), mgr.get(input)]);
    resolve({ name: "x" });
    expect(await both).toEqual(["x", "x"]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns null on failure, does not retry for a while, then tries again", async () => {
    const create = jest.fn().mockRejectedValueOnce(new Error("below minimum token count")).mockResolvedValue({ name: "ok" });
    const { mgr, advance } = setup(create);
    expect(await mgr.get(input)).toBeNull();
    expect(await mgr.get(input)).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
    advance(CONTEXT_CACHE_NEGATIVE_MS + 1);
    expect(await mgr.get(input)).toBe("ok");
  });

  it("treats a nameless reply as a failure", async () => {
    const { mgr } = setup(jest.fn().mockResolvedValue({}));
    expect(await mgr.get(input)).toBeNull();
  });

  it("invalidate forces a fresh create", async () => {
    const create = jest.fn().mockResolvedValueOnce({ name: "a" }).mockResolvedValueOnce({ name: "b" });
    const { mgr } = setup(create);
    await mgr.get(input);
    mgr.invalidate(input.key, input.model);
    expect(await mgr.get(input)).toBe("b");
  });
});

describe("isStaleCacheError", () => {
  it("recognises a vanished cache but not quota or safety errors", () => {
    expect(isStaleCacheError(new Error("CachedContent not found (or permission denied)"))).toBe(true);
    expect(isStaleCacheError(new Error("Cache has expired"))).toBe(true);
    expect(isStaleCacheError(new Error("429 RESOURCE_EXHAUSTED quota"))).toBe(false);
    expect(isStaleCacheError(new Error("blocked by safety"))).toBe(false);
  });
});
