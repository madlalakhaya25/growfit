/**
 * Gemini CONTEXT caching: a stored prompt PREFIX, referenced by name so it is
 * not re-sent (and re-billed at full price) on every turn.
 *
 * Not to be confused with `ai_artefacts` / `generateOrServeText`, which cache
 * ANSWERS. Different keys (a hash of the prefix here, the inputs fingerprint
 * there), different lifetimes (an hour here), and different failure modes: a
 * missing context cache must never be an error — the caller sends the prefix
 * inline instead.
 *
 * Explicit caches have a model-specific minimum size, and a small squad's
 * stable brief can fall below it, in which case `create` rejects. That is
 * expected, so a failure is remembered for a while rather than retried on every
 * turn, and `get` resolves to null — "send it inline".
 */

export interface CachesApi {
  create(params: {
    model: string;
    config: {
      contents: unknown;
      systemInstruction: string;
      ttl: string;
      displayName?: string;
    };
  }): Promise<{ name?: string }>;
}

export const CONTEXT_CACHE_TTL_SECONDS = 3600;
/** Stop handing out a cache this close to its server-side expiry. */
const REFRESH_MARGIN_SECONDS = 300;
/** How long a failed create (e.g. below the minimum size) is not retried. */
export const CONTEXT_CACHE_NEGATIVE_MS = 10 * 60_000;

type Entry = { name: string; expiresAt: number } | { failedUntil: number };

export interface ContextCacheManager {
  /** The cache's resource name, or null when the prefix should go inline. */
  get(input: {
    key: string;
    model: string;
    systemInstruction: string;
    contents: unknown;
  }): Promise<string | null>;
  /** Forget a cache the server rejected (expired early, deleted). */
  invalidate(key: string, model: string): void;
}

export function createContextCacheManager(deps: {
  caches: CachesApi;
  now?: () => number;
}): ContextCacheManager {
  const now = deps.now ?? Date.now;
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Promise<string | null>>();
  const slot = (key: string, model: string) => `${model}|${key}`;

  return {
    async get({ key, model, systemInstruction, contents }) {
      const id = slot(key, model);
      const hit = entries.get(id);
      if (hit) {
        if ("name" in hit && hit.expiresAt > now()) return hit.name;
        if ("failedUntil" in hit && hit.failedUntil > now()) return null;
        entries.delete(id);
      }
      const pending = inflight.get(id);
      if (pending) return pending;

      const create = (async () => {
        try {
          const res = await deps.caches.create({
            model,
            config: {
              contents,
              systemInstruction,
              ttl: `${CONTEXT_CACHE_TTL_SECONDS}s`,
              displayName: `growfit:${key}`.slice(0, 120),
            },
          });
          if (!res.name) throw new Error("cache create returned no name");
          entries.set(id, {
            name: res.name,
            expiresAt: now() + (CONTEXT_CACHE_TTL_SECONDS - REFRESH_MARGIN_SECONDS) * 1000,
          });
          return res.name;
        } catch {
          // Expected for a stable brief under the model's minimum size.
          entries.set(id, { failedUntil: now() + CONTEXT_CACHE_NEGATIVE_MS });
          return null;
        } finally {
          inflight.delete(id);
        }
      })();
      inflight.set(id, create);
      return create;
    },
    invalidate(key, model) {
      entries.delete(slot(key, model));
    },
  };
}

/** True when an SDK error says the referenced cache is gone, as opposed to some other failure. */
export function isStaleCacheError(err: unknown): boolean {
  const text = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return /cached ?content|cache/.test(text) && /(not found|expired|permission|invalid)/.test(text);
}
