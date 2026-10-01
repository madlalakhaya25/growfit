import { TOOL_LABELS } from "./index";
import { selectCitedLinks } from "./links";
import type { AgentLink, AgentToolResult } from "./types";

/** A tool round is one model turn that asked for tools. Bounds cost and prevents a loop. */
export const MAX_TOOL_ROUNDS = 5;

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "links"; links: AgentLink[] }
  | { type: "done" }
  | { type: "error"; message: string };

export interface ModelCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

/** One streamed piece of a model turn, already stripped of SDK types. */
export interface ModelChunk {
  /** Visible text delta. */
  text?: string;
  /**
   * The raw `Part`s of this chunk. Kept verbatim and replayed in the next
   * request: Gemini 3 needs the `thoughtSignature` on a function-call part
   * handed back, and re-synthesising the part would drop it.
   */
  parts?: unknown[];
  calls?: ModelCall[];
}

export interface LoopContent {
  role: "user" | "model";
  parts: unknown[];
}

export interface RunLoopDeps {
  /** One streamed model turn. `allowTools: false` omits the tool declarations. */
  generate(contents: LoopContent[], opts: { allowTools: boolean }): AsyncIterable<ModelChunk>;
  execute(name: string, args: unknown): Promise<AgentToolResult>;
  /** Maps any thrown provider error to a user-safe sentence. */
  toError(err: unknown): string;
}

/**
 * The agent loop, with no Next.js, Supabase or SDK in it — the route supplies
 * those as `deps` — so the round cap and the tool-result plumbing can be unit
 * tested with a stubbed model.
 *
 *  1. Stream a turn. Forward text as it arrives.
 *  2. If the model asked for tools, run them, feed the results back, repeat.
 *  3. After MAX_TOOL_ROUNDS rounds, make one last call with tools withheld so
 *     the turn always ends in an answer.
 *
 * Budget is the caller's concern and is consumed once per user turn, not per
 * round: a tool round is not a new user request.
 */
export async function* runAgentLoop(
  deps: RunLoopDeps,
  initial: LoopContent[]
): AsyncGenerator<AgentEvent> {
  const contents = [...initial];
  const links: AgentLink[] = [];
  // Only the FINAL answer decides which rows were cited; text from earlier
  // tool rounds is usually a preamble, and is included anyway (cheap and safe).
  let answer = "";

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const allowTools = round < MAX_TOOL_ROUNDS;
      const parts: unknown[] = [];
      const calls: ModelCall[] = [];

      for await (const chunk of deps.generate(contents, { allowTools })) {
        if (chunk.text) {
          answer += chunk.text;
          yield { type: "text", delta: chunk.text };
        }
        if (chunk.parts) parts.push(...chunk.parts);
        // The forced final round has no tools declared; ignore a stray call.
        if (allowTools && chunk.calls) calls.push(...chunk.calls);
      }

      if (calls.length === 0) break;

      contents.push({ role: "model", parts });
      const responses: unknown[] = [];
      for (const call of calls) {
        yield { type: "tool", name: call.name, label: TOOL_LABELS[call.name] ?? "looking that up…" };
        const result = await deps.execute(call.name, call.args);
        if (result.ok) links.push(...result.links);
        responses.push({
          functionResponse: {
            name: call.name,
            ...(call.id ? { id: call.id } : {}),
            response: result.ok ? { output: result.data } : { error: result.error },
          },
        });
      }
      contents.push({ role: "user", parts: responses });
    }
  } catch (err) {
    yield { type: "error", message: deps.toError(err) };
    return;
  }

  const cited = selectCitedLinks(links, answer);
  if (cited.length) yield { type: "links", links: cited };
  yield { type: "done" };
}
