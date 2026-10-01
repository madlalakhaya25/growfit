export const MAX_QUESTION_CHARS = 1000;
export const MAX_HISTORY_TURNS = 8;
const MAX_TURN_CHARS = 4000;

export interface AgentTurn {
  role: "user" | "model";
  text: string;
}
export interface AgentRequest {
  question: string;
  history: AgentTurn[];
  teamId?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates the POST body. Pure, so the route stays I/O only.
 *
 * Gemini requires turns to strictly alternate; a question that errored
 * client-side leaves a user turn with no model reply, and resending it would
 * put two user turns back to back (a 400 INVALID_ARGUMENT). Trailing user
 * turns are dropped, exactly as `askCoachAssistant` does.
 */
export function parseAgentRequest(body: unknown): { ok: true; value: AgentRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid request." };
  const b = body as Record<string, unknown>;

  const question = typeof b.question === "string" ? b.question.trim() : "";
  if (!question) return { ok: false, error: "Ask a question first." };
  if (question.length > MAX_QUESTION_CHARS) return { ok: false, error: "That question is a bit long — try trimming it." };

  let teamId: string | undefined;
  if (b.teamId !== undefined && b.teamId !== null) {
    if (typeof b.teamId !== "string" || !UUID_RE.test(b.teamId)) return { ok: false, error: "Invalid request." };
    teamId = b.teamId;
  }

  const rawHistory = b.history === undefined ? [] : b.history;
  if (!Array.isArray(rawHistory)) return { ok: false, error: "Invalid request." };
  const history: AgentTurn[] = [];
  for (const t of rawHistory.slice(-MAX_HISTORY_TURNS)) {
    if (!t || typeof t !== "object") return { ok: false, error: "Invalid request." };
    const { role, text } = t as Record<string, unknown>;
    if ((role !== "user" && role !== "model") || typeof text !== "string") return { ok: false, error: "Invalid request." };
    history.push({ role, text: text.slice(0, MAX_TURN_CHARS) });
  }
  while (history.length > 0 && history[history.length - 1].role === "user") history.pop();

  return { ok: true, value: { question, history, teamId } };
}
