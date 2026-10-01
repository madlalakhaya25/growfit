import type { AgentEvent } from "@/lib/ai-tools/run-loop";

/**
 * Splits an SSE byte stream into events. Pure so it can be tested without a
 * fetch. Returns whatever trailing text is not yet a complete frame so the
 * caller can prepend it to the next network chunk — a frame routinely arrives
 * split across two.
 */
export function parseSseBuffer(buffer: string): { events: AgentEvent[]; rest: string } {
  const events: AgentEvent[] = [];
  const frames = buffer.split("\n\n");
  const rest = frames.pop() ?? "";
  for (const frame of frames) {
    const data = frame
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const ev = JSON.parse(data) as AgentEvent;
      if (ev && typeof ev.type === "string") events.push(ev);
    } catch {
      // A malformed frame is skipped, never fatal to the rest of the stream.
    }
  }
  return { events, rest };
}

export interface AgentAskInput {
  question: string;
  history: { role: "user" | "model"; text: string }[];
  teamId?: string;
  page?: string;
}

/** POSTs to /api/agent and yields events as they stream in. */
export async function* streamAgent(input: AgentAskInput, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = "The assistant couldn't be reached. Try again.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      // keep the generic message
    }
    yield { type: "error", message };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseBuffer(buffer);
    buffer = rest;
    for (const ev of events) yield ev;
  }
}
