"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageSquare, Send, ListChecks, ClipboardList, Loader2 } from "lucide-react";
import { askCoachAssistant, suggestLineup, generateMatchPlan, type CoachMessage } from "@/app/actions/coach-assistant";
import { SpeakButton } from "@/components/tactics/speak-button";
import { FORMATIONS } from "@/lib/formations";

export interface AssistantTeam { id: string; name: string; age_group: string | null }
export interface AssistantFixture { id: string; label: string; when: string }

const STARTERS = [
  "Who should start on Sunday?",
  "Who needs a welfare check-in?",
  "What should we work on at training this week?",
  "Which players are improving fastest?",
];

export function CoachAssistantPanel({
  teams,
  fixtures,
}: {
  teams: AssistantTeam[];
  fixtures: Record<string, AssistantFixture[]>;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const [fixtureId, setFixtureId] = useState("");
  const [formation, setFormation] = useState("11-4-3-3");
  const [output, setOutput] = useState<{ title: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const teamFixtures = fixtures[teamId] ?? [];

  function send(question: string) {
    const q = question.trim();
    if (!q || isPending) return;
    setError(null);
    setInput("");
    const next: CoachMessage[] = [...messages, { role: "user", text: q }];
    setMessages(next);

    start(async () => {
      const res = await askCoachAssistant({ teamId, history: messages, question: q });
      if (res.error) {
        setError(res.error);
        setMessages(next);
        return;
      }
      setMessages([...next, { role: "model", text: res.answer ?? "" }]);
    });
  }

  async function runLineup() {
    setBusy("lineup");
    setOutput(null);
    const res = await suggestLineup({ teamId, fixtureId: fixtureId || undefined, formation });
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setOutput({ title: "Suggested XI", text: res.lineup ?? "" });
  }

  async function runPlan() {
    if (!fixtureId) { setError("Pick a fixture to build a match plan."); return; }
    setBusy("plan");
    setOutput(null);
    const res = await generateMatchPlan({ teamId, fixtureId });
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setOutput({ title: "Match plan", text: res.plan ?? "" });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary shrink-0" aria-hidden="true" />
          <p className="font-semibold text-sm">AI Coach Assistant</p>
        </div>
        {teams.length > 1 && (
          <select
            value={teamId}
            onChange={(e) => { setTeamId(e.target.value); setMessages([]); setOutput(null); setFixtureId(""); }}
            aria-label="Team"
            className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.age_group ? ` · ${t.age_group}` : ""}</option>
            ))}
          </select>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        <p className="text-xs text-muted-foreground">
          Ask anything about your squad — it answers using your real players, ratings, attendance and results.
        </p>

        {/* Quick tools */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={fixtureId}
              onChange={(e) => setFixtureId(e.target.value)}
              aria-label="Fixture"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">No fixture selected</option>
              {teamFixtures.map((f) => (
                <option key={f.id} value={f.id}>{f.when} · {f.label}</option>
              ))}
            </select>
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
              aria-label="Formation"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {FORMATIONS.map((f) => (
                <option key={f.id} value={f.label}>{f.label} · {f.format}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={runLineup} disabled={busy !== null} className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {busy === "lineup" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <ListChecks className="size-3" aria-hidden="true" />}
              Suggest XI
            </button>
            <button type="button" onClick={runPlan} disabled={busy !== null} className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50">
              {busy === "plan" ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <ClipboardList className="size-3 text-primary" aria-hidden="true" />}
              Match plan
            </button>
          </div>
        </div>

        {output && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-1 max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{output.title}</p>
              <SpeakButton text={output.text} />
            </div>
            {output.text.split("\n").filter(Boolean).map((l, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed">{l}</p>
            ))}
          </div>
        )}

        {/* Conversation */}
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
                  : "mr-auto max-w-[92%] rounded-lg border border-border bg-background px-3 py-2 space-y-1"}
              >
                {m.role === "user" ? (
                  <p>{m.text}</p>
                ) : (
                  <>
                    {m.text.split("\n").filter(Boolean).map((l, j) => (
                      <p key={j} className="text-xs text-muted-foreground leading-relaxed">{l}</p>
                    ))}
                    <SpeakButton text={m.text} />
                  </>
                )}
              </div>
            ))}
            {isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="animate-spin inline-block size-3.5 border-2 border-primary border-t-transparent rounded-full" />
                Looking at your squad…
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your squad…"
            maxLength={1000}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={isPending || !input.trim()}
            className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Send className="size-3.5" aria-hidden="true" />
          </button>
        </form>

        {messages.length > 0 && (
          <button type="button" onClick={() => { setMessages([]); setError(null); }} className="text-[11px] text-muted-foreground underline">
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}
