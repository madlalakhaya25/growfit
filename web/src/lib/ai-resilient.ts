/**
 * Retry wrapper for Gemini calls that fail because Google is busy.
 *
 * A 503 "This model is currently experiencing high demand" is Google shedding
 * load, not a fault in the request, and it usually clears within seconds. Before
 * this, one such answer failed the whole feature with a generic message and the
 * coach had to press the button again by hand. Only the "busy" family is
 * retried (503 / UNAVAILABLE / overloaded); a bad key, a safety block or a 429
 * quota error would fail identically the next time, so they surface at once.
 *
 * If GEMINI_MODEL_FALLBACK is set, a last attempt goes to that model, so one
 * overloaded model does not take every AI feature down with it.
 */

import type { GoogleGenAI } from "@google/genai";

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/** Seconds are scarce in a Server Action: two short waits, not an open loop. */
const BACKOFF_MS = [800, 2000];

export function isModelBusy(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 503) return true;
  let text = "";
  if (err instanceof Error) text = err.message.toLowerCase();
  else if (typeof err === "string") text = err.toLowerCase();
  return (
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("overloaded") ||
    text.includes('"code":503')
  );
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Response = Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;

// Recursion rather than a loop: each retry has to wait for the one before it.
async function attempt(ai: GoogleGenAI, params: GenerateParams, tryNo: number): Promise<Response> {
  try {
    return await ai.models.generateContent(params);
  } catch (err) {
    if (!isModelBusy(err)) throw err;
    if (tryNo < BACKOFF_MS.length) {
      await sleep(BACKOFF_MS[tryNo]);
      return attempt(ai, params, tryNo + 1);
    }
    const fallback = process.env.GEMINI_MODEL_FALLBACK;
    if (fallback && fallback !== params.model) {
      try {
        return await ai.models.generateContent({ ...params, model: fallback });
      } catch {
        // Fallback busy or failing too: report the original model's answer.
      }
    }
    throw err;
  }
}

export function generateWithRetry(ai: GoogleGenAI, params: GenerateParams) {
  return attempt(ai, params, 0);
}
