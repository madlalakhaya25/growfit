import { clearLocalData, isAppStorageKey, keepCachedPath } from "../clear-local-data";

describe("isAppStorageKey", () => {
  it("matches the app's own key styles and nothing else", () => {
    for (const k of ["growfit.tactics.draft.t1", "growfit:minutes:f1", "growfit-ask-growfit"]) expect(isAppStorageKey(k)).toBe(true);
    for (const k of ["theme", "growfitx", "other.growfit.x", "sb-token"]) expect(isAppStorageKey(k)).toBe(false);
  });
});

describe("keepCachedPath", () => {
  it("keeps only static files and the offline page, never a dashboard page", () => {
    expect(keepCachedPath("/_next/static/chunks/a.js")).toBe(true);
    expect(keepCachedPath("/offline")).toBe(true);
    expect(keepCachedPath("/dashboard/coach/squad")).toBe(false);
    expect(keepCachedPath("/offline/x")).toBe(false);
  });
});

describe("clearLocalData", () => {
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches;
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
  });

  it("removes this app's keys, the offline queue and cached pages, and leaves other keys", async () => {
    localStorage.setItem("growfit.tactics.draft.t1", "x");
    localStorage.setItem("theme", "dark");
    sessionStorage.setItem("growfit-ask-growfit", "x");
    const deleted: string[] = [];
    const cache = {
      keys: async () => [{ url: "https://a.test/dashboard/coach" }, { url: "https://a.test/_next/static/a.js" }, { url: "https://a.test/offline" }],
      delete: async (r: { url: string }) => { deleted.push(new URL(r.url).pathname); return true; },
    };
    Object.assign(globalThis, { caches: { keys: async () => ["v2"], open: async () => cache } });
    const dbs: string[] = [];
    Object.assign(globalThis, {
      indexedDB: { deleteDatabase: (n: string) => { dbs.push(n); const r: { onsuccess?: () => void } = {}; setTimeout(() => r.onsuccess?.()); return r; } },
    });

    await clearLocalData();

    expect(localStorage.getItem("growfit.tactics.draft.t1")).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(sessionStorage.getItem("growfit-ask-growfit")).toBeNull();
    expect(deleted).toEqual(["/dashboard/coach"]);
    expect(dbs).toEqual(["growfit-offline-queue"]);
  });

  it("still resolves when the browser has no cache or database support", async () => {
    await expect(clearLocalData()).resolves.toBeUndefined();
  });
});
