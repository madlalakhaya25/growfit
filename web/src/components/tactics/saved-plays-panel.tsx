"use client";

import { useEffect, useState } from "react";
import { FolderOpen, Save, Send, Sparkles, Swords, Trash2 } from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import { useBoardSetupStore } from "@/store/boardSetupStore";
import { useBoardPlaybackStore } from "@/store/boardPlaybackStore";
import { useSavedPlaysStore } from "@/store/savedPlaysStore";
import { savePlay, listPlays, loadPlay, deletePlay, sharePlayToSquad, listLinkTargets } from "@/app/actions/tactic-plays";
import { describePlay, analyseOpponent } from "@/app/actions/tactics";
import { SpeakButton } from "@/components/tactics/speak-button";
import { VoiceNoteRecorder } from "@/components/tactics/voice-note-recorder";
import { TACTICAL_CONCEPTS, TACTICAL_CATEGORIES, getConcept } from "@/lib/tactics";
import { PLAY_TEMPLATES, expandTemplate } from "@/lib/play-templates";
import { FORMATIONS } from "@/lib/formations";
import { AiProse } from "@/components/ai/ai-prose";
import type { BoardState } from "@/store/boardStore";
import type { Frame } from "@/lib/board-model";

/**
 * The board's "Plays" card: start-from-template, name/tag/link a play,
 * save/describe/counter/share it, and the saved-plays list itself
 * (load/delete/filter). First panel extracted out of tactical-board.tsx
 * (docs/BACKLOG.md 3.3) — most self-contained, and backed by its own
 * savedPlaysStore.ts slice from the state migration that came before it.
 *
 * The AI describe/analyse buttons and their result panels live in this
 * same component rather than a separate one, even though the original plan
 * sequenced them as a later, distinct extraction: the actual markup never
 * separated them into two visual regions — they're one interleaved card —
 * so splitting them out would be a UI redesign, not a behavior-preserving
 * refactor. See docs/BACKLOG.md 3.3's Shipped note for this call.
 *
 * Reads/writes boardStore, boardSetupStore, boardPlaybackStore and
 * savedPlaysStore directly rather than via props — the payoff of the
 * earlier state-slice migration. `busy`/`notice` stay props: they're
 * genuinely used board-wide (animation capture, recording, substitutions,
 * pitch switching all set them too), not panel-local state. `snapshot`/
 * `clearDraft` stay props too: they belong to the undo/history and
 * draft-autosave systems, both still local to tactical-board.tsx and
 * scheduled as their own later extractions.
 */
export interface SavedPlaysPanelProps {
  ageGroup: string;
  busy: string | null;
  setBusy: (busy: string | null) => void;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  snapshot: () => void;
  clearDraft: () => void;
}

export function SavedPlaysPanel({ ageGroup, busy, setBusy, notice, setNotice, snapshot, clearDraft }: SavedPlaysPanelProps) {
  const { state, setState } = useBoardStore();
  const {
    teamId, homeFormationId, setHomeFormationId, awayFormationId, setAwayFormationId,
    pitchId, setPitchId,
  } = useBoardSetupStore();
  const { frames, setFrames } = useBoardPlaybackStore();
  const {
    plays, setPlays, playName, setPlayName, currentPlayId, setCurrentPlayId,
    conceptIds, setConceptIds, sessionId, setSessionId, fixtureId, setFixtureId,
    targets, setTargets, filterConcept, setFilterConcept,
  } = useSavedPlaysStore();

  // AI describer + opponent analysis, and the voice note attached to the
  // currently-open play — all three used only within this panel.
  const [description, setDescription] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);

  async function refreshPlays(id = teamId) {
    if (!id) return;
    const res = await listPlays(id, "pitch");
    if (res.plays) setPlays(res.plays);
  }
  useEffect(() => {
    // Standard fetch-on-dependency-change: refreshPlays/listLinkTargets are
    // async, and their setState calls (setPlays, setTargets) happen after
    // an await, not synchronously in this effect body.
    void refreshPlays(teamId);
    if (teamId) void listLinkTargets(teamId).then(setTargets);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [teamId]);

  async function handleSave() {
    const name = playName.trim();
    if (!name) { setNotice("Give the play a name first."); return; }
    setBusy("save");
    const res = await savePlay({
      playId: currentPlayId ?? undefined,
      teamId,
      name,
      data: { tokens: state.tokens, shapes: state.shapes, objects: state.objects, playerNotes: state.playerNotes, pitchId, frames, homeFormationId, awayFormationId },
      conceptIds,
      sessionId: sessionId || null,
      fixtureId: fixtureId || null,
    });
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    setCurrentPlayId(res.id ?? null);
    clearDraft();
    setNotice(`Saved "${name}".`);
    void refreshPlays();
  }

  async function handleLoad(id: string) {
    setBusy("load");
    const res = await loadPlay(id);
    setBusy(null);
    if (res.error || !res.data) { setNotice(res.error ?? "Could not load play."); return; }
    const d = res.data as Partial<BoardState & { frames: Frame[]; homeFormationId: string; awayFormationId: string; pitchId: string }>;
    snapshot();
    setState({ tokens: d.tokens ?? [], shapes: d.shapes ?? [], objects: d.objects ?? [], playerNotes: d.playerNotes ?? [] });
    setPitchId(d.pitchId ?? "full");
    setFrames(d.frames ?? []);
    if (d.homeFormationId) setHomeFormationId(d.homeFormationId);
    if (d.awayFormationId) setAwayFormationId(d.awayFormationId);
    setCurrentPlayId(id);
    setPlayName(res.name ?? "");
    const meta = plays.find((p) => p.id === id);
    setConceptIds(meta?.concept_ids ?? []);
    setSessionId(meta?.session_id ?? "");
    setFixtureId(meta?.fixture_id ?? "");
    setDescription(null);
    setAnalysis(null);
    setVoiceUrl(meta?.voice_url ?? null);
    clearDraft();
    setNotice(`Loaded "${res.name}".`);
  }

  /** Load a pre-built pattern onto the board as a starting point. */
  function loadTemplate(id: string) {
    const tpl = PLAY_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const { tokens, shapes, frames: tplFrames } = expandTemplate(tpl);
    snapshot();
    setState({ tokens: tokens as BoardState["tokens"], shapes: shapes as BoardState["shapes"], objects: [], playerNotes: [] });
    setPitchId("full");
    setFrames(tplFrames as Frame[]);
    setConceptIds([tpl.conceptId]);
    setCurrentPlayId(null);
    setPlayName(tpl.label);
    setDescription(null);
    setAnalysis(null);
    setVoiceUrl(null);
    setNotice("Template loaded — press Play under the pitch to watch it, then drag it about and save it as your own.");
  }

  /** Turn the board into text the model can reason about. */
  function summariseBoard(): string {
    const zone = (y: number) => (y < 50 ? "attacking third" : y < 100 ? "middle third" : "defensive third");
    const side = (x: number) => (x < 33 ? "left" : x > 67 ? "right" : "central");

    const players = state.tokens.filter((t) => t.kind === "player");
    const opponents = state.tokens.filter((t) => t.kind === "opponent");
    const ball = state.tokens.find((t) => t.kind === "ball");

    const lines: string[] = [];
    lines.push(`Formation: ${FORMATIONS.find((f) => f.id === homeFormationId)?.label ?? "custom"} vs ${FORMATIONS.find((f) => f.id === awayFormationId)?.label ?? "unknown"}.`);
    lines.push(`Our players on the board (${players.length}):`);
    players.forEach((p) => lines.push(`- ${p.label || "player"} (${p.group}) in the ${side(p.x)} ${zone(p.y)}`));
    if (opponents.length) {
      lines.push(`Opponent players on the board (${opponents.length}):`);
      opponents.forEach((o) => lines.push(`- opponent ${o.label || "?"} in the ${side(o.x)} ${zone(o.y)}`));
      const deepest = Math.min(...opponents.map((o) => o.y));
      const highest = Math.max(...opponents.map((o) => o.y));
      lines.push(`Their block spans from the ${zone(highest)} back to the ${zone(deepest)}, so it is ${highest - deepest > 60 ? "stretched" : "compact"}.`);
    }
    if (ball) lines.push(`Ball starts in the ${side(ball.x)} ${zone(ball.y)}.`);

    // Spotlights aren't a line from A to B (they're one point, a ring on a
    // player) — describe them separately rather than as a degenerate
    // "freehand mark from X to X" the arrow-description below would read.
    const lineShapes = state.shapes.filter((sh) => sh.kind !== "spotlight");
    const spotlights = state.shapes.filter((sh) => sh.kind === "spotlight");

    if (lineShapes.length) {
      lines.push("Lines drawn:");
      lineShapes.forEach((sh) => {
        const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
        const kind = sh.kind === "run" ? "a run" : sh.kind === "pass" ? "a pass" : sh.kind === "dribble" ? "a dribble" : "a freehand mark";
        lines.push(`- ${kind} from the ${side(a.x)} ${zone(a.y)} to the ${side(b.x)} ${zone(b.y)}`);
      });
    } else {
      lines.push("No runs or passes drawn.");
    }

    if (spotlights.length) {
      lines.push("Players highlighted:");
      spotlights.forEach((sh) => {
        const p = state.tokens.find((t) => t.playerId === sh.playerId);
        lines.push(`- ${p?.label ?? "a player"}`);
      });
    }

    lines.push(frames.length >= 2
      ? `The play has ${frames.length} movement steps captured as a sequence.`
      : "No movement sequence captured.");

    return lines.join("\n");
  }

  async function handleDescribe() {
    setBusy("describe");
    setDescription(null);
    const res = await describePlay({
      playName: playName.trim(),
      ageGroup,
      conceptLabels: conceptIds.map((id) => getConcept(id)?.label ?? id),
      summary: summariseBoard(),
    });
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    setDescription(res.description ?? null);
  }

  async function handleAnalyseOpponent() {
    if (!state.tokens.some((t) => t.kind === "opponent")) {
      setNotice("Set up the opponent XI first so there's a shape to analyse.");
      return;
    }
    setBusy("analyse");
    setAnalysis(null);
    const res = await analyseOpponent({
      ageGroup,
      opponentFormation: FORMATIONS.find((f) => f.id === awayFormationId)?.label ?? "unknown",
      ourFormation: FORMATIONS.find((f) => f.id === homeFormationId)?.label ?? "custom",
      summary: summariseBoard(),
      availableFormations: FORMATIONS.map((f) => `${f.label} (${f.format})`),
    });
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    setAnalysis(res.analysis ?? null);
  }

  async function handleDelete(id: string) {
    setBusy("delete");
    const res = await deletePlay(id);
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    if (currentPlayId === id) { setCurrentPlayId(null); }
    setNotice("Play deleted.");
    void refreshPlays();
  }

  async function handleShare() {
    const name = playName.trim();
    if (!name) { setNotice("Name and save the play before sharing."); return; }
    if (!currentPlayId) { setNotice("Save the play before sharing it."); return; }
    setBusy("share");
    const res = await sharePlayToSquad({ teamId, playId: currentPlayId, playName: name });
    setBusy(null);
    setNotice(res.error ?? `Shared "${name}" with the squad.`);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <FolderOpen className="size-3.5 text-primary" aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plays</p>
      </div>
      <select
        value=""
        aria-label="Start from a template"
        onChange={(e) => { if (e.target.value) loadTemplate(e.target.value); }}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Start from a template…</option>
        {PLAY_TEMPLATES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>

      <input
        type="text"
        value={playName}
        onChange={(e) => setPlayName(e.target.value)}
        placeholder="Play name e.g. High press trigger"
        maxLength={80}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {/* Tag by tactical concept */}
      <details className="rounded-md border border-border bg-background">
        <summary className="cursor-pointer px-2 py-1.5 text-xs text-muted-foreground">
          Concepts {conceptIds.length > 0 && `(${conceptIds.length})`}
        </summary>
        <div className="max-h-40 overflow-y-auto px-2 pb-2 space-y-1.5">
          {TACTICAL_CATEGORIES.map((cat) => {
            const items = TACTICAL_CONCEPTS.filter((c) => c.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground pt-1">{cat}</p>
                {items.map((c) => (
                  <label key={c.id} className="flex items-start gap-1.5 py-0.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conceptIds.includes(c.id)}
                      onChange={(e) =>
                        setConceptIds((ids) =>
                          e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)
                        )
                      }
                      className="mt-0.5"
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      </details>

      {/* Attach to a session or fixture */}
      <select
        value={sessionId}
        onChange={(e) => { setSessionId(e.target.value); if (e.target.value) setFixtureId(""); }}
        aria-label="Attach to training session"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Not attached to a session</option>
        {targets.sessions.map((s) => (
          <option key={s.id} value={s.id}>{s.when} · {s.label}</option>
        ))}
      </select>
      <select
        value={fixtureId}
        onChange={(e) => { setFixtureId(e.target.value); if (e.target.value) setSessionId(""); }}
        aria-label="Attach to fixture"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Not attached to a fixture</option>
        {targets.fixtures.map((f) => (
          <option key={f.id} value={f.id}>{f.when} · {f.label}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={handleSave} disabled={busy !== null} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="size-3" aria-hidden="true" /> {currentPlayId ? "Update" : "Save"}
        </button>
        <button type="button" onClick={handleDescribe} disabled={busy !== null} title="Generate coaching points from the board" className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50">
          <Sparkles className="size-3 text-primary" aria-hidden="true" />
          {busy === "describe" ? "Thinking…" : "Describe"}
        </button>
        <button type="button" onClick={handleAnalyseOpponent} disabled={busy !== null} title="Analyse the opponent shape and advise how to counter it" className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50">
          <Swords className="size-3 text-primary" aria-hidden="true" />
          {busy === "analyse" ? "Analysing…" : "Counter them"}
        </button>
        <button type="button" onClick={handleShare} disabled={busy !== null} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50">
          <Send className="size-3" aria-hidden="true" /> Share to squad
        </button>
        {currentPlayId && (
          <button type="button" onClick={() => { setCurrentPlayId(null); setPlayName(""); setVoiceUrl(null); setAnalysis(null); setDescription(null); }} className="inline-flex h-10 sm:h-8 items-center rounded-md border border-border bg-background px-2 text-xs hover:bg-muted">
            New
          </button>
        )}
      </div>
      {/* Voice note — the coach's own explanation, heard by players */}
      <VoiceNoteRecorder
        key={currentPlayId ?? "new"}
        playId={currentPlayId}
        initialUrl={voiceUrl}
        onChange={setVoiceUrl}
      />

      {description && (
        <div className="rounded-md border border-border bg-background p-2 space-y-1 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Coaching points</p>
            <SpeakButton text={description} />
          </div>
          <AiProse text={description} className="text-xs" />
        </div>
      )}

      {analysis && (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-1 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Countering the opponent</p>
            <SpeakButton text={analysis} />
          </div>
          <AiProse text={analysis} className="text-xs" />
        </div>
      )}

      {plays.length > 1 && (
        <select
          value={filterConcept}
          onChange={(e) => setFilterConcept(e.target.value)}
          aria-label="Filter plays by concept"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All plays</option>
          {TACTICAL_CONCEPTS.filter((c) => plays.some((p) => p.concept_ids?.includes(c.id))).map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      )}

      {plays.length > 0 && (
        <ul className="space-y-1 pt-1">
          {plays
            .filter((p) => !filterConcept || p.concept_ids?.includes(filterConcept))
            .map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleLoad(p.id)}
                className={`flex-1 truncate rounded-md border px-2 py-1 text-left text-xs hover:bg-muted ${
                  currentPlayId === p.id ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                {p.name}
              </button>
              <button type="button" onClick={() => handleDelete(p.id)} title="Delete play" className="rounded-md border border-border bg-background px-2 py-2 sm:py-1 hover:bg-muted">
                <Trash2 className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && <p className="text-[11px] text-muted-foreground pt-1">{notice}</p>}
    </div>
  );
}
