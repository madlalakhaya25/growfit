/**
 * Shared guard rails for the AI features.
 *
 * Two problems this fixes, both across all thirteen AI actions:
 *
 * 1. Every `catch` ended `return { error: err instanceof Error ? err.message
 *    : "AI service unavailable." }` — so whatever Google's SDK happened to
 *    throw went straight to a coach's screen. That is at best unreadable
 *    ("[GoogleGenerativeAI Error]: fetch failed"), and at worst leaks
 *    internals: provider error bodies routinely carry the model id, the
 *    endpoint, quota details, and in some failure modes a fragment of the
 *    request. `friendlyError()` already does this job for Postgres errors;
 *    AI providers fail in their own ways and need their own mapping.
 *
 * 2. Nothing limited how often these could be called. `proxy.ts`'s limiter
 *    covers the auth routes only, so any signed-in account could hold down
 *    a button and bill the academy's Gemini key indefinitely.
 */

/**
 * Plain-language AI failure, with the original logged rather than shown.
 *
 * Matches on message shape rather than a status code because the
 * `@google/genai` SDK does not expose a stable typed error — it throws
 * plain `Error`s whose text carries the cause.
 */
export function aiError(err: unknown, fallback = "The AI service is unavailable right now. Try again in a moment."): string {
  // Always keep the real thing for debugging — this is the only place it
  // survives, since it deliberately never reaches the UI.
  console.error("[ai]", err);

  const raw = err instanceof Error ? err.message : String(err ?? "");
  const text = raw.toLowerCase();

  if (!process.env.GEMINI_API_KEY) {
    return "AI features aren't configured for this academy yet. Ask your admin to add an AI key.";
  }
  if (text.includes("api key") || text.includes("api_key") || text.includes("permission denied") || text.includes("unauthenticated")) {
    return "The academy's AI key was rejected. Ask your admin to check it.";
  }
  if (text.includes("quota") || text.includes("resource_exhausted") || text.includes("429") || text.includes("rate limit")) {
    return "The academy's AI quota is used up for now. Try again later.";
  }
  if (text.includes("safety") || text.includes("blocked") || text.includes("recitation")) {
    return "The AI declined to answer that one. Try rephrasing it.";
  }
  if (text.includes("deadline") || text.includes("timeout") || text.includes("timed out") || text.includes("aborted")) {
    return "The AI took too long to answer. Try again.";
  }
  if (text.includes("fetch failed") || text.includes("network") || text.includes("enotfound") || text.includes("econnrefused")) {
    return "Couldn't reach the AI service. Check your connection and try again.";
  }
  if (text.includes("not found") && text.includes("model")) {
    // The exact failure that broke every AI feature when Google retired the
    // 2.5 generation — worth naming the remedy rather than saying "error".
    return "The configured AI model is no longer available. An admin needs to update GEMINI_MODEL.";
  }
  return fallback;
}

// ── Per-user call budget ──────────────────────────────────────────
//
// In-memory and therefore per process instance, exactly like the auth
// limiter in `proxy.ts` and with the same caveat: on a multi-instance
// deployment the real ceiling is this times the instance count. A shared
// store (Upstash Redis) is the proper fix and needs credentials this
// environment does not have. It is still worth having — the failure it
// prevents is an unbounded bill, and an approximate ceiling bounds that,
// where no ceiling at all does not.
const aiCallLog = new Map<string, { count: number; resetAt: number }>();

/** An hour is long enough to cover a session on the touchline. */
const AI_BUDGET = { windowMs: 60 * 60_000, max: 60 };

/**
 * Consumes one unit of a user's AI budget.
 *
 * Returns an error string when the user is over budget, `null` when the
 * call may proceed. Deliberately counts *attempts*, not successes: a
 * failing call still costs a request to the provider.
 */
export function checkAiBudget(userId: string): string | null {
  const now = Date.now();
  const entry = aiCallLog.get(userId);

  if (!entry || entry.resetAt <= now) {
    aiCallLog.set(userId, { count: 1, resetAt: now + AI_BUDGET.windowMs });
    return null;
  }
  if (entry.count >= AI_BUDGET.max) {
    const minutes = Math.max(1, Math.ceil((entry.resetAt - now) / 60_000));
    return `That's a lot of AI requests in one go — try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  entry.count += 1;

  // The map would otherwise grow one entry per user forever. Cheap sweep,
  // only when it has grown enough to be worth one.
  if (aiCallLog.size > 500) {
    for (const [key, value] of aiCallLog) {
      if (value.resetAt <= now) aiCallLog.delete(key);
    }
  }
  return null;
}

/** Test seam — the budget is process-global, so tests must be able to reset it. */
export function __resetAiBudget() {
  aiCallLog.clear();
}
