import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { AI_MODEL } from "@/lib/ai-models";
import { aiError, checkAiBudget } from "@/lib/ai-guard";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildAgentContext } from "@/lib/ai-tools/context";
import { agentSystem } from "@/lib/ai-tools/agent-prompt";
import { parseAgentRequest } from "@/lib/ai-tools/agent-request";
import { executeTool, toolDeclarations } from "@/lib/ai-tools";
import { runAgentLoop, type AgentEvent, type LoopContent, type ModelCall, type ModelChunk } from "@/lib/ai-tools/run-loop";

// Streaming needs a Route Handler: a Server Action returns once. This is the
// one deliberate departure from the all-Server-Actions pattern (web/CLAUDE.md).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// The one place `thinkingBudget: 0` is relaxed: this is the genuinely
// multi-step call. Thinking tokens are deducted from maxOutputTokens, so the
// output ceiling sits well above the thinking budget. Watch for answers that
// stop mid-sentence — truncation here has no error.
const THINKING_BUDGET = 512;
const MAX_OUTPUT_TOKENS = 1800;

type SdkPart = { text?: string; thought?: boolean; functionCall?: { name?: string; args?: Record<string, unknown>; id?: string } };

function sse(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Unauthenticated callers are redirected, matching every other guarded
 * route. NB `proxy.ts` treats the whole `/api` prefix as public, so this
 * handler authenticates for itself — it cannot lean on the proxy.
 */
export async function GET() {
  await requireUser();
  return NextResponse.json({ error: "Use POST." }, { status: 405 });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // A streaming fetch can't usefully follow a redirect, so POST answers 401.
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await buildAgentContext(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "The agent is for coaches and admins." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseAgentRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { question, history, teamId } = parsed.value;

  // A team the caller can't access is dropped, not trusted.
  const currentTeam = teamId ? (ctx.teams.find((t) => t.id === teamId) ?? null) : null;

  // Once per user turn — not per tool round (see runAgentLoop).
  const overBudget = await checkAiBudget(user.id);
  if (overBudget) return NextResponse.json({ error: overBudget }, { status: 429 });

  const system = agentSystem({ currentTeam });
  const initial: LoopContent[] = [
    ...history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: question }] },
  ];

  async function* generate(contents: LoopContent[], opts: { allowTools: boolean }): AsyncGenerator<ModelChunk> {
    const stream = await ai.models.generateContentStream({
      model: AI_MODEL,
      // The loop keeps SDK Parts opaque; they are replayed exactly as received.
      contents: contents as never,
      config: {
        systemInstruction: system,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
        tools: opts.allowTools ? [{ functionDeclarations: toolDeclarations() }] : undefined,
        automaticFunctionCalling: { disable: true },
      },
    });
    for await (const chunk of stream) {
      // Read parts directly: the `.text` getter warns whenever a function-call
      // part is present.
      const parts = ((chunk.candidates?.[0]?.content?.parts ?? []) as SdkPart[]);
      const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("");
      const calls: ModelCall[] = parts
        .filter((p) => p.functionCall?.name)
        .map((p) => ({ name: p.functionCall!.name!, args: p.functionCall!.args ?? {}, id: p.functionCall!.id }));
      yield { text: text || undefined, parts, calls };
    }
  }

  const events = runAgentLoop(
    { generate, execute: (name, args) => executeTool(ctx, name, args), toError: (e) => aiError(e) },
    initial
  );

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of events) controller.enqueue(encoder.encode(sse(ev)));
      } catch (err) {
        controller.enqueue(encoder.encode(sse({ type: "error", message: aiError(err) })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
