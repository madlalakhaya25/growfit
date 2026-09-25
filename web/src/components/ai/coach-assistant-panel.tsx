"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquare, Send, ListChecks, ClipboardList, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  askCoachAssistant, suggestLineup, generateMatchPlan,
  type CoachMessage, type LineupStructured, type MatchPlanStructured,
} from "@/app/actions/coach-assistant";
import { savePlay } from "@/app/actions/tactic-plays";
import { saveMatchPlan } from "@/app/actions/match-plans";
import { SpeakButton } from "@/components/tactics/speak-button";
import { AiProse } from "@/components/ai/ai-prose";
import { FORMATIONS } from "@/lib/formations";
import { mapNamedPositionsToSlots, groupOf, shortLabel, uid, type BoardPlayer, type Token } from "@/lib/board-model";
import { useAskGrowfitStore } from "@/store/askGrowfitStore";

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
  roster,
}: {
  teams: AssistantTeam[];
  fixtures: Record<string, AssistantFixture[]>;
  /** Team rosters keyed by team id, so a suggested XI can be matched to real
   * players and saved as a play — sourced the same way board/page.tsx loads
   * its own roster. */
  roster: Record<string, BoardPlayer[]>;
}) {
  // Rehydrates the persisted conversation once mounted. Deferred to an
  // effect rather than read during the initial render, so the server's
  // render (no sessionStorage) and the client's first render agree before
  // this fills in — see askGrowfitStore.ts.
  useEffect(() => {
    useAskGrowfitStore.persist.rehydrate();
  }, []);

  const teamId = useAskGrowfitStore((s) => s.teamId);
  const setTeamId = useAskGrowfitStore((s) => s.setTeamId);
  const messages = useAskGrowfitStore((s) => s.messages);
  const setMessages = useAskGrowfitStore((s) => s.setMessages);
  const fixtureId = useAskGrowfitStore((s) => s.fixtureId);
  const setFixtureId = useAskGrowfitStore((s) => s.setFixtureId);
  const formation = useAskGrowfitStore((s) => s.formation);
  const setFormation = useAskGrowfitStore((s) => s.setFormation);
  const output = useAskGrowfitStore((s) => s.output);
  const setOutput = useAskGrowfitStore((s) => s.setOutput);
  const applied = useAskGrowfitStore((s) => s.applied);
  const setApplied = useAskGrowfitStore((s) => s.setApplied);
  const clearConversation = useAskGrowfitStore((s) => s.clearConversation);

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const [busy, setBusy] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // A persisted teamId from a previous session, or none at all yet, might
  // no longer be one of this coach's teams (removed, or a fresh store) --
  // fall back to the first team the same way the un-persisted version did.
  const resolvedTeamId = teams.some((t) => t.id === teamId) ? teamId : (teams[0]?.id ?? "");

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const teamFixtures = fixtures[resolvedTeamId] ?? [];
  const teamRoster = roster[resolvedTeamId] ?? [];

  function send(question: string) {
    const q = question.trim();
    if (!q || isPending) return;
    setError(null);
    setInput("");
    const next: CoachMessage[] = [...messages, { role: "user", text: q }];
    setMessages(next);

    start(async () => {
      const res = await askCoachAssistant({ teamId: resolvedTeamId, history: messages, question: q });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        setMessages(next);
        return;
      }
      setMessages([...next, { role: "model", text: res.answer ?? "" }]);
    });
  }

  async function runLineup() {
    setBusy("lineup");
    setOutput(null);
    setApplied(false);
    const res = await suggestLineup({ teamId: resolvedTeamId, fixtureId: fixtureId || undefined, formation });
    setBusy(null);
    if (res.error) { setError(res.error); toast.error(res.error); return; }
    setOutput({ kind: "lineup", text: res.lineup ?? "", structured: res.structured });
  }

  /**
   * Save the suggested XI as a brand-new play — never overwriting whatever
   * the coach currently has open on the tactical board (confirmed,
   * non-negotiable: this always inserts, so savePlay is called with no
   * playId). Matches each suggested name to the real roster by
   * case-insensitive full-name comparison, then reuses assignToSlots' exact
   * cascade (via mapNamedPositionsToSlots) so a suggested position label
   * that doesn't exactly match a formation slot's role still lands
   * sensibly rather than erroring.
   */
  async function applyLineup(structured: LineupStructured) {
    const formationObj = FORMATIONS.find((f) => f.label === formation) ?? FORMATIONS.find((f) => f.id === formation);
    if (!formationObj) { toast.error("Could not resolve the selected formation."); return; }
    if (teamRoster.length === 0) { toast.error("No roster loaded for this team."); return; }

    const byName = new Map(teamRoster.map((p) => [p.full_name.trim().toLowerCase(), p]));
    const picks: { position: string; playerId: string }[] = [];
    const unmatched: string[] = [];
    for (const pick of structured.startingXI) {
      const player = byName.get(pick.name.trim().toLowerCase());
      if (player) picks.push({ position: pick.position, playerId: player.id });
      else unmatched.push(pick.name);
    }
    if (picks.length === 0) {
      toast.error("None of the suggested names matched this team's roster.");
      return;
    }

    const slotPlayerIds = mapNamedPositionsToSlots(formationObj, picks);
    const byId = new Map(teamRoster.map((p) => [p.id, p]));
    const tokens: Token[] = [];
    slotPlayerIds.forEach((playerId, i) => {
      if (!playerId) return;
      const player = byId.get(playerId);
      if (!player) return;
      const slot = formationObj.slots[i];
      tokens.push({
        id: uid("t"),
        kind: "player",
        x: slot.x,
        y: slot.y,
        label: shortLabel(player.full_name),
        group: groupOf(player.position),
        playerId: player.id,
      });
    });

    setApplying(true);
    const res = await savePlay({
      teamId: resolvedTeamId,
      name: `AI suggestion — ${new Date().toLocaleDateString()}`,
      data: { tokens, shapes: [], objects: [], playerNotes: [] },
    });
    setApplying(false);

    if (res.error) { toast.error(res.error); return; }
    setApplied(true);
    toast.success(
      unmatched.length > 0
        ? `Saved as a new play (${unmatched.length} name${unmatched.length === 1 ? "" : "s"} not matched to the roster).`
        : "Saved as a new play."
    );
  }

  async function runPlan() {
    if (!fixtureId) { setError("Pick a fixture to build a match plan."); return; }
    setBusy("plan");
    setOutput(null);
    setApplied(false);
    const res = await generateMatchPlan({ teamId: resolvedTeamId, fixtureId });
    setBusy(null);
    if (res.error) { setError(res.error); toast.error(res.error); return; }
    setOutput({ kind: "plan", text: res.plan ?? "", structured: res.structured, fixtureId });
  }

  /**
   * Save the generated match plan against its fixture — always an
   * upsert-in-place (fixture_match_plans.fixture_id is UNIQUE), so
   * re-applying overwrites the previous plan rather than accumulating
   * history (confirmed decision, same as tactic_plays' upsert-on-playId).
   */
  async function applyMatchPlan(structured: MatchPlanStructured, planFixtureId: string) {
    setApplying(true);
    const res = await saveMatchPlan({ fixtureId: planFixtureId, teamId: resolvedTeamId, data: structured });
    setApplying(false);
    if (res.error) { toast.error(res.error); return; }
    setApplied(true);
    toast.success("Match plan saved to this fixture.");
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
            value={resolvedTeamId}
            onChange={(e) => { setTeamId(e.target.value); clearConversation(); setOutput(null); setApplied(false); setFixtureId(""); }}
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
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {output.kind === "lineup" ? "Suggested XI" : "Match plan"}
              </p>
              <SpeakButton text={output.text} />
            </div>
            <AiProse text={output.text} />
            {output.kind === "lineup" && output.structured && (
              <div className="pt-1">
                {applied ? (
                  <p className="text-xs text-muted-foreground">
                    Saved.{" "}
                    <Link href="/dashboard/coach/tactics/board" className="underline hover:text-foreground">
                      Open the tactical board
                    </Link>{" "}
                    to view it under Saved Plays.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => applyLineup(output.structured!)}
                    disabled={applying}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    {applying ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Save className="size-3 text-primary" aria-hidden="true" />}
                    Apply — save as new play
                  </button>
                )}
              </div>
            )}
            {output.kind === "plan" && output.structured && (
              <div className="pt-1">
                {applied ? (
                  <p className="text-xs text-muted-foreground">Saved to this fixture.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => applyMatchPlan(output.structured!, output.fixtureId)}
                    disabled={applying}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    {applying ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Save className="size-3 text-primary" aria-hidden="true" />}
                    Apply — save to fixture
                  </button>
                )}
              </div>
            )}
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
                  ? "ml-auto max-w-[85%] rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                  : "mr-auto max-w-[92%] rounded-lg border border-border bg-background px-3 py-2 space-y-1"}
              >
                {m.role === "user" ? (
                  <p>{m.text}</p>
                ) : (
                  <>
                    <AiProse text={m.text} />
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
          <button type="button" onClick={() => { clearConversation(); setError(null); }} className="text-[11px] text-muted-foreground underline">
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}
