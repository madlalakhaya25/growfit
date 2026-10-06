"use client";

/**
 * Everything this app keeps on a device that is about children: the offline
 * attendance queue, unsaved tactics and minutes drafts, the Ask Growfit
 * transcript, and the cached page HTML the service worker keeps for offline
 * use. Sign-out must remove all of it, or the next person on a shared phone can
 * open the last coach's pages offline. Pure helpers are exported for tests.
 */

const OFFLINE_DB = "growfit-offline-queue";
const OFFLINE_PAGE = "/offline";
const STATIC_PREFIX = "/_next/static/";

/** Browser-storage keys this app writes: `growfit.`, `growfit:` and `growfit-` prefixes. */
export function isAppStorageKey(key: string): boolean {
  return /^growfit[.:-]/.test(key);
}

/** Cached responses that hold no personal data and keep the app loading offline. */
export function keepCachedPath(pathname: string): boolean {
  return pathname === OFFLINE_PAGE || pathname.startsWith(STATIC_PREFIX);
}

function clearStorage(store: Storage) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && isAppStorageKey(k)) keys.push(k);
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    /* storage unavailable: nothing was written there */
  }
}

async function clearPageCache() {
  if (typeof caches === "undefined") return;
  for (const name of await caches.keys()) {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) {
      if (!keepCachedPath(new URL(req.url).pathname)) await cache.delete(req);
    }
  }
}

function clearOfflineQueue(): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(OFFLINE_DB);
    // Blocked means a tab still holds it open; it is deleted once that tab closes.
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

/** Best effort and never throws: a failure here must not stop the sign-out. */
export async function clearLocalData(): Promise<void> {
  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
  await Promise.allSettled([clearOfflineQueue(), clearPageCache()]);
}
