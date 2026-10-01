"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import { streamAgent } from "./agent-sse";
import { isInternalHref } from "@/lib/ai-tools/links";
import type { AgentLink } from "@/lib/ai-tools/types";

interface Turn {
  role: "user" | "model";
  text: string;
  links?: AgentLink[];
}

/**
 * Streaming consumer for /api/agent: tokens appear as they arrive, a status
 * line names the tool being used ("checking attendance…"), and the players and
 * fixtures the answer drew on are offered as one-tap chips underneath.
 *
 * Not mounted anywhere yet — step 2.7 gives it a page, a nav entry and the
 * current page's context.
 */
export function AgentStream({ teamId }: { teamId?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: question }, { role: "model", text: "" }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      for await (const ev of streamAgent({ question, history, teamId }, ctrl.signal)) {
        if (ev.type === "text") {
          setStatus(null);
          setTurns((t) => {
            const next = [...t];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, text: last.text + ev.delta };
            return next;
          });
        } else if (ev.type === "tool") {
          setStatus(ev.label);
        } else if (ev.type === "links") {
          setTurns((t) => {
            const next = [...t];
            next[next.length - 1] = { ...next[next.length - 1], links: ev.links };
            return next;
          });
        } else if (ev.type === "error") {
          setError(ev.message);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("The assistant couldn't be reached. Try again.");
    } finally {
      setBusy(false);
      setStatus(null);
      // An empty model turn (an error before any text) would otherwise be
      // replayed as history and break the user/model alternation.
      setTurns((t) => (t.length && t[t.length - 1].role === "model" && !t[t.length - 1].text ? t.slice(0, -1) : t));
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "text-right" : ""}>
            <p
              className={
                "inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
                (t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")
              }
            >
              {t.text || (busy && i === turns.length - 1 ? "…" : "")}
            </p>
            {t.links && t.links.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {t.links.filter((l) => isInternalHref(l.href)).map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {status && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> {status}
          </p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="Ask about your squad…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          aria-label="Ask the assistant"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ask
        </button>
      </form>
    </div>
  );
}
