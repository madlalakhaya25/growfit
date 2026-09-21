/**
 * Rate limiting with one seam, two backends.
 *
 * Both `proxy.ts`'s auth-route limiter and the per-user AI call budget
 * (`lib/ai-guard.ts`) keep their counters in a plain in-memory `Map`, and
 * both carry the same comment: "for multi-instance deployments, replace
 * with a shared store like Upstash Redis." On Vercel that is not a caveat,
 * it is the normal case — every request can land on a different serverless
 * instance, each with its own empty Map, so the real ceiling today is
 * `max` × (however many instances happen to be warm), not `max`.
 *
 * This module is that replacement, built without an Upstash account to test
 * against: it talks to Upstash's REST API directly over `fetch` (no SDK
 * dependency, and the REST API — not a TCP client — is what actually works
 * in Vercel's Edge runtime, which is what `proxy.ts` runs under). With no
 * credentials configured it falls back to today's in-memory behaviour
 * exactly, so nothing changes for either caller until someone adds two
 * environment variables.
 *
 * ## Turning on the shared store
 *
 * 1. Create a Redis database at upstash.com (free tier is enough for this
 *    app's volume) and copy its REST URL and token.
 * 2. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
 *
 * No code changes and no redeploy of calling code — `isRateLimitShared()`
 * flips to true and `checkRateLimit()` starts hitting Redis on its own.
 *
 * This has been exercised against a mocked Upstash response (see
 * `__tests__/rate-limit.test.ts`) but never against a real Upstash
 * instance, since none exists in this environment. Verify against a real
 * one before relying on it in production.
 */

export interface RateLimitConfig {
  /** A namespace plus the caller's own key, e.g. `"auth:203.0.113.4"` or
   *  `"ai:<user-id>"`. Kept as one string (not split into params) so the
   *  Redis key and the in-memory Map key are identical, which matters for
   *  writing one set of tests that mean the same thing against both. */
  key: string;
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Present only when blocked — how long until the window resets. */
  retryAfterMs?: number;
}

/** Whether a shared store is configured. Exposed so a settings or health
 *  page can tell an admin the limiter is still per-instance, which is the
 *  state described in `ROADMAP.md`'s architectural backlog today. */
export function isRateLimitShared(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// ── In-memory backend (today's behaviour) ───────────────────────────
//
// One process-wide map shared by every caller of `checkRateLimit()`, keyed
// by the caller's own namespaced string, so an auth-route key and an AI-user
// key can never collide.
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Bounded so a very active academy can't grow this without limit between
// Redis being configured — this is pure best-effort until then.
const MAX_MEMORY_ENTRIES = 10_000;

function checkInMemory({ key, windowMs, max }: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    if (memoryStore.size >= MAX_MEMORY_ENTRIES) {
      // Sweep expired entries before growing further, rather than just
      // refusing new keys — a burst of unique IPs shouldn't itself become
      // an outage.
      for (const [k, v] of memoryStore) {
        if (v.resetAt <= now) memoryStore.delete(k);
      }
    }
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}

// ── Upstash REST backend ─────────────────────────────────────────────
//
// One pipelined request: INCR the key, PEXPIRE it (NX — only if it has no
// TTL yet, i.e. only on the first hit in a window) so the window's
// lifetime is set exactly once, then PTTL to report how long is left.
// Three commands, one round trip.
async function checkUpstash(
  { key, windowMs, max }: RateLimitConfig,
  baseUrl: string,
  token: string
): Promise<RateLimitResult> {
  const redisKey = `ratelimit:${key}`;

  const response = await fetch(`${baseUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
      ["PTTL", redisKey],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit request failed: ${response.status}`);
  }

  const results = (await response.json()) as { result: unknown; error?: string }[];
  const [incrResult, , pttlResult] = results;

  if (incrResult?.error) throw new Error(`Upstash INCR failed: ${incrResult.error}`);

  const count = Number(incrResult.result);
  const ttlMs = Number(pttlResult?.result);
  // A missing/negative TTL (e.g. lost race with an expiring key) falls back
  // to the full window rather than reporting a nonsensical retry time.
  const retryAfterMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : windowMs;

  if (count > max) {
    return { allowed: false, retryAfterMs };
  }
  return { allowed: true };
}

/**
 * Check and consume one unit against a rate limit.
 *
 * Uses the shared Upstash store when configured, the in-memory Map
 * otherwise. On a Redis error (network blip, misconfigured credentials)
 * this **fails open** — the request is allowed and the error is reported —
 * rather than locking out every user because a rate limiter's dependency
 * had a bad moment. A broken limiter should degrade toward "no limit,"
 * which is the state the app is already in without a shared store, not
 * toward "nobody can log in."
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return checkInMemory(config);
  }

  try {
    return await checkUpstash(config, url, token);
  } catch (error) {
    // Lazy import to avoid a hard circular dependency between this module
    // and reportError's own callers (none today, but rate-limit sits low
    // in the dependency graph and should stay that way).
    const { reportError } = await import("./report-error");
    reportError(error, { scope: "checkRateLimit", extra: { key: config.key } });
    return { allowed: true };
  }
}

/** Test-only: clears the in-memory backend between test cases. */
export function __resetRateLimitMemory() {
  memoryStore.clear();
}
