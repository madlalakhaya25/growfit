/**
 * Parse a JSON-mode Gemini response into an object: try a straight
 * JSON.parse first, then fall back to the first `{...}` object in the text
 * for when the model wraps its JSON in prose despite the schema. Returns
 * null rather than throwing so callers can fall back to a plain error
 * message.
 *
 * Shared by every JSON-mode AI action (coach-assistant.ts,
 * session-generator.ts, tactics.ts) — it used to be copied into each.
 */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // The outermost {...}: first "{" to last "}". Plain index lookups
    // rather than a /\{[\s\S]*\}/ regex, which backtracks badly on long
    // replies with no closing brace.
    const start = text.indexOf("{"), end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
