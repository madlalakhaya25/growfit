"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MousePointer2, Eraser, Undo2, Redo2, RotateCcw, Users, Circle,
  ArrowUpRight, Minus, Waves, Pencil, Download, Tag, Grid3x3,
  Play, Square, Plus, Save, FolderOpen, Send, Trash2, Film, Video, Sparkles, Swords,
} from "lucide-react";
import { POSITIONS } from "@/lib/types";
import { FORMATIONS, FORMATION_SIZES, type Formation } from "@/lib/formations";
import { savePlay, listPlays, loadPlay, deletePlay, sharePlayToSquad, listLinkTargets, type SavedPlaySummary, type LinkTarget } from "@/app/actions/tactic-plays";
import { describePlay, analyseOpponent } from "@/app/actions/tactics";
import { SpeakButton } from "@/components/tactics/speak-button";
import { VoiceNoteRecorder } from "@/components/tactics/voice-note-recorder";
import { TACTICAL_CONCEPTS, TACTICAL_CATEGORIES, getConcept } from "@/lib/tactics";
import { PLAY_TEMPLATES, expandTemplate } from "@/lib/play-templates";
import { drawBoard, pickRecorderMime } from "@/lib/board-render";
import { framesFromShapes } from "@/lib/play-motion";

// ── Types ────────────────────────────────────────────────────────
export interface BoardPlayer {
  id: string;
  full_name: string;
  position: string | null;
}
export interface BoardTeam {
  id: string;
  name: string;
  age_group: string | null;
  players: BoardPlayer[];
}
interface Token {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "player" | "opponent" | "ball";
  group: string;
  playerId?: string;
}
type ShapeKind = "run" | "pass" | "dribble" | "free";
interface Shape {
  id: string;
  kind: ShapeKind;
  pts: { x: number; y: number }[];
}
interface BoardState {
  tokens: Token[];
  shapes: Shape[];
}
type Mode = "move" | "run" | "pass" | "dribble" | "free" | "erase";

/** One step of a play: where every token sits, plus the lines drawn at that step. */
interface Frame {
  id: string;
  tokens: { id: string; x: number; y: number }[];
  shapes: Shape[];
}
type Overlay = "none" | "thirds" | "channels" | "zone14";

// ── Pitch geometry (attacking upward) ────────────────────────────
const W = 100;
const H = 150;

const GROUP_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const GROUP_COLOR: Record<string, string> = {
  Goalkeeper: "#f59e0b",
  Defender: "#3b82f6",
  Midfielder: "#22c55e",
  Forward: "#ef4444",
  Opponent: "#0f172a",
  Ball: "#f8fafc",
};

function groupOf(position: string | null): string {
  if (!position) return "Midfielder";
  return POSITIONS.find((p) => p.value === position)?.group ?? "Midfielder";
}
function shortLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > 9 ? first.slice(0, 8) + "…" : first;
}

let idc = 0;
const uid = (p: string) => `${p}-${++idc}`;

/**
 * Assign real players to formation slots: exact position match first, then
 * same position group, then whoever is left — so a right back lands at right
 * back rather than wherever the list order happens to put them.
 */
function assignToSlots(formation: Formation, roster: BoardPlayer[]): (BoardPlayer | undefined)[] {
  const pool = [...roster];
  const out: (BoardPlayer | undefined)[] = new Array(formation.slots.length).fill(undefined);

  const take = (pred: (p: BoardPlayer) => boolean) => {
    const i = pool.findIndex(pred);
    return i === -1 ? undefined : pool.splice(i, 1)[0];
  };

  formation.slots.forEach((slot, i) => {
    const p = take((pl) => pl.position === slot.role);
    if (p) out[i] = p;
  });
  formation.slots.forEach((slot, i) => {
    if (out[i]) return;
    const p = take((pl) => groupOf(pl.position) === groupOf(slot.role));
    if (p) out[i] = p;
  });
  formation.slots.forEach((_, i) => {
    if (out[i]) return;
    out[i] = pool.shift();
  });
  return out;
}

/**
 * Squeeze a full-pitch formation slot into one half, so two teams can be shown
 * facing each other. Home keeps the bottom half, away is mirrored into the top.
 * GK sits deepest, the furthest forward player sits nearest halfway.
 */
function compress(slot: { x: number; y: number }, side: "home" | "away"): { x: number; y: number } {
  const DEEPEST = 142, HIGHEST = 38; // y range formations actually use
  const t = Math.max(0, Math.min(1, (DEEPEST - slot.y) / (DEEPEST - HIGHEST)));
  return side === "home"
    ? { x: slot.x, y: 146 - t * 68 }        // 146 (own goal) → 78 (just short of halfway)
    : { x: W - slot.x, y: 4 + t * 68 };     // 4 (their goal) → 72, mirrored across
}

/** Wavy path for a dribble line. */
function dribblePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return `M${x1},${y1}`;
  const px = -dy / len, py = dx / len;
  const n = Math.max(2, Math.round(len / 3.2));
  let d = `M${x1},${y1}`;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    const off = (i % 2 === 0 ? 1 : -1) * 1.5;
    d += ` L${(cx + px * off).toFixed(2)},${(cy + py * off).toFixed(2)}`;
  }
  return d + ` L${x2},${y2}`;
}
/**
 * Tactical overlays. Half-spaces are the two channels between the centre and
 * the wings — the highest-value areas to attack from, and the thing coaches
 * most often want to point at.
 */
function OverlayLayer({ overlay }: { overlay: Overlay }) {
  if (overlay === "none") return null;
  const line = "rgba(255,255,255,0.35)";

  if (overlay === "thirds") {
    return (
      <g pointerEvents="none">
        <rect x={2} y={2} width={W - 4} height={(H - 4) / 3} fill="#ef4444" opacity={0.1} />
        <rect x={2} y={2 + (H - 4) / 3} width={W - 4} height={(H - 4) / 3} fill="#eab308" opacity={0.08} />
        <rect x={2} y={2 + (2 * (H - 4)) / 3} width={W - 4} height={(H - 4) / 3} fill="#3b82f6" opacity={0.1} />
        <g stroke={line} strokeWidth={0.4} strokeDasharray="2 2">
          <line x1={2} y1={2 + (H - 4) / 3} x2={W - 2} y2={2 + (H - 4) / 3} />
          <line x1={2} y1={2 + (2 * (H - 4)) / 3} x2={W - 2} y2={2 + (2 * (H - 4)) / 3} />
        </g>
        <g fill="rgba(255,255,255,0.75)" fontSize={3.4} textAnchor="middle">
          <text x={50} y={26}>Attacking third</text>
          <text x={50} y={76}>Middle third</text>
          <text x={50} y={126}>Defensive third</text>
        </g>
      </g>
    );
  }

  if (overlay === "channels") {
    // Five vertical channels: wing / half-space / centre / half-space / wing.
    const edges = [2, 21, 38, 62, 79, 98];
    return (
      <g pointerEvents="none">
        <rect x={edges[1]} y={2} width={edges[2] - edges[1]} height={H - 4} fill="#a855f7" opacity={0.16} />
        <rect x={edges[3]} y={2} width={edges[4] - edges[3]} height={H - 4} fill="#a855f7" opacity={0.16} />
        <g stroke={line} strokeWidth={0.4} strokeDasharray="2 2">
          {edges.slice(1, -1).map((x) => (
            <line key={x} x1={x} y1={2} x2={x} y2={H - 2} />
          ))}
        </g>
        <g fill="rgba(255,255,255,0.8)" fontSize={3} textAnchor="middle">
          <text x={11.5} y={H / 2}>Wing</text>
          <text x={29.5} y={H / 2 - 4}>Half</text>
          <text x={29.5} y={H / 2}>space</text>
          <text x={50} y={H / 2}>Centre</text>
          <text x={70.5} y={H / 2 - 4}>Half</text>
          <text x={70.5} y={H / 2}>space</text>
          <text x={88.5} y={H / 2}>Wing</text>
        </g>
      </g>
    );
  }

  // Zone 14 — the pocket just outside the box where most chances are created.
  return (
    <g pointerEvents="none">
      <rect x={38} y={22} width={24} height={22} fill="#f97316" opacity={0.28} />
      <rect x={38} y={22} width={24} height={22} fill="none" stroke={line} strokeWidth={0.4} strokeDasharray="2 2" />
      <text x={50} y={35} fill="rgba(255,255,255,0.9)" fontSize={3.6} textAnchor="middle">Zone 14</text>
      <rect x={26} y={2} width={12} height={20} fill="#22d3ee" opacity={0.2} />
      <rect x={62} y={2} width={12} height={20} fill="#22d3ee" opacity={0.2} />
      <text x={50} y={52} fill="rgba(255,255,255,0.7)" fontSize={2.6} textAnchor="middle">cut-back zones shaded</text>
    </g>
  );
}

function polyPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function TacticalBoard({ teams }: { teams: BoardTeam[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [homeFormationId, setHomeFormationId] = useState("11-4-3-3");
  const [awayFormationId, setAwayFormationId] = useState("11-4-4-2");
  const [mode, setMode] = useState<Mode>("move");
  const [showNames, setShowNames] = useState(true);
  const [overlay, setOverlay] = useState<Overlay>("none");

  const [state, setState] = useState<BoardState>({ tokens: [], shapes: [] });
  const [draft, setDraft] = useState<Shape | null>(null);

  // Animation
  const [frames, setFrames] = useState<Frame[]>([]);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [anim, setAnim] = useState<BoardState | null>(null);
  const rafRef = useRef<number | null>(null);

  // Saved plays
  const [plays, setPlays] = useState<SavedPlaySummary[]>([]);
  const [playName, setPlayName] = useState("");
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Tagging + linking
  const [conceptIds, setConceptIds] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [fixtureId, setFixtureId] = useState<string>("");
  const [targets, setTargets] = useState<{ sessions: LinkTarget[]; fixtures: LinkTarget[] }>({ sessions: [], fixtures: [] });
  const [filterConcept, setFilterConcept] = useState<string>("");

  // AI describer + opponent analysis
  const [description, setDescription] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const past = useRef<BoardState[]>([]);
  const future = useRef<BoardState[]>([]);
  const [, forceRender] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const drawing = useRef(false);

  const team = teams.find((t) => t.id === teamId);

  const roster = useMemo(() => {
    const rs = [...(team?.players ?? [])];
    rs.sort((a, b) => GROUP_ORDER.indexOf(groupOf(a.position)) - GROUP_ORDER.indexOf(groupOf(b.position)));
    return rs;
  }, [team]);

  const placed = new Set(state.tokens.filter((t) => t.playerId).map((t) => t.playerId));
  const bench = roster.filter((p) => !placed.has(p.id));

  /** What the pitch renders: the animated snapshot while playing, else live state. */
  const view = anim ?? state;

  // ── History ────────────────────────────────────────────────────
  function snapshot() {
    past.current.push(JSON.parse(JSON.stringify(stateRef.current)) as BoardState);
    if (past.current.length > 40) past.current.shift();
    future.current = [];
  }
  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(JSON.parse(JSON.stringify(stateRef.current)) as BoardState);
    setState(prev);
    forceRender((n) => n + 1);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(JSON.parse(JSON.stringify(stateRef.current)) as BoardState);
    setState(next);
    forceRender((n) => n + 1);
  }

  // ── Animation ──────────────────────────────────────────────────
  function captureFrame() {
    const f: Frame = {
      id: uid("f"),
      tokens: state.tokens.map((t) => ({ id: t.id, x: t.x, y: t.y })),
      shapes: JSON.parse(JSON.stringify(state.shapes)) as Shape[],
    };
    setFrames((fs) => [...fs, f]);
    setNotice(`Step ${frames.length + 1} captured.`);
  }
  function updateFrame(i: number) {
    setFrames((fs) =>
      fs.map((f, idx) =>
        idx === i
          ? { ...f, tokens: state.tokens.map((t) => ({ id: t.id, x: t.x, y: t.y })), shapes: JSON.parse(JSON.stringify(state.shapes)) as Shape[] }
          : f
      )
    );
    setNotice(`Step ${i + 1} updated.`);
  }
  function deleteFrame(i: number) {
    setFrames((fs) => fs.filter((_, idx) => idx !== i));
  }
  /** Jump the board to a stored step so the coach can edit it. */
  function gotoFrame(i: number) {
    const f = frames[i];
    if (!f) return;
    snapshot();
    setState((st) => ({
      tokens: st.tokens.map((t) => {
        const p = f.tokens.find((ft) => ft.id === t.id);
        return p ? { ...t, x: p.x, y: p.y } : t;
      }),
      shapes: JSON.parse(JSON.stringify(f.shapes)) as Shape[],
    }));
  }

  function stopPlayback() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    setAnim(null);
  }

  /** Play the captured steps back, easing token positions between each pair. */
  function playAnimation(override?: Frame[]) {
    // Captured steps win; otherwise animate what the drawn arrows describe, so
    // drawing a play and pressing Play does the obvious thing.
    let seqFrames = override ?? frames;
    if (seqFrames.length < 2) {
      const derived = framesFromShapes(state.tokens, state.shapes) as Frame[];
      if (derived.length >= 2) {
        seqFrames = derived;
        setFrames(derived);
      } else {
        setNotice(
          state.shapes.length > 0
            ? "Draw a run or pass that starts on a player, or capture steps by hand."
            : "Draw some runs and passes, or capture steps by hand, then press Play."
        );
        return;
      }
    }
    stopPlayback();
    setPlaying(true);

    const SEG = 1100; // ms per step
    const start = performance.now();
    const total = SEG * (seqFrames.length - 1);
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const tick = (now: number) => {
      const elapsed = now - start;
      const clamped = Math.min(elapsed, total);
      const seg = Math.min(Math.floor(clamped / SEG), seqFrames.length - 2);
      const local = ease(Math.min((clamped - seg * SEG) / SEG, 1));

      const from = seqFrames[seg];
      const to = seqFrames[seg + 1];

      setAnim({
        tokens: state.tokens.map((t) => {
          const a = from.tokens.find((ft) => ft.id === t.id);
          const b = to.tokens.find((ft) => ft.id === t.id);
          if (!a || !b) return t;
          return { ...t, x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
        }),
        shapes: to.shapes,
      });

      if (elapsed < total) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setPlaying(false);
        setAnim(null);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  /**
   * Record the play sequence to a video file. The board is redrawn to an
   * offscreen canvas each animation frame and MediaRecorder captures that
   * canvas stream, so the export matches exactly what playback shows.
   */
  async function recordAnimation() {
    let seqFrames = frames;
    if (seqFrames.length < 2) {
      const derived = framesFromShapes(state.tokens, state.shapes) as Frame[];
      if (derived.length < 2) {
        setNotice("Draw runs and passes, or capture steps, before recording.");
        return;
      }
      seqFrames = derived;
      setFrames(derived);
    }
    const mime = pickRecorderMime();
    if (!mime) {
      setNotice("This browser can't record video. Try Chrome, or use PNG export.");
      return;
    }

    stopPlayback();
    setRecording(true);
    setNotice("Recording…");

    const scale = 6;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setRecording(false); return; }

    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
    rec.start();

    const SEG = 1100;
    const total = SEG * (seqFrames.length - 1);
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const startedAt = performance.now();

    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = Math.min(now - startedAt, total);
        const seg = Math.min(Math.floor(elapsed / SEG), seqFrames.length - 2);
        const local = ease(Math.min((elapsed - seg * SEG) / SEG, 1));
        const from = seqFrames[seg];
        const to = seqFrames[seg + 1];

        const tokens = state.tokens.map((t) => {
          const a = from.tokens.find((ft) => ft.id === t.id);
          const b = to.tokens.find((ft) => ft.id === t.id);
          if (!a || !b) return t;
          return { ...t, x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
        });

        drawBoard(ctx, { tokens, shapes: to.shapes, overlay, showNames, scale });

        if (now - startedAt < total) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    // Hold the final frame briefly so the video doesn't cut dead on the last step.
    await new Promise((r) => setTimeout(r, 500));
    rec.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    a.download = `${(playName || team?.name || "play").trim()}.${ext}`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    URL.revokeObjectURL(a.href);

    setRecording(false);
    setNotice("Recording saved to your downloads.");
  }

  // ── Saved plays ────────────────────────────────────────────────
  async function refreshPlays(id = teamId) {
    if (!id) return;
    const res = await listPlays(id);
    if (res.plays) setPlays(res.plays);
  }
  useEffect(() => {
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
      data: { tokens: state.tokens, shapes: state.shapes, frames, homeFormationId, awayFormationId },
      conceptIds,
      sessionId: sessionId || null,
      fixtureId: fixtureId || null,
    });
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    setCurrentPlayId(res.id ?? null);
    setNotice(`Saved "${name}".`);
    void refreshPlays();
  }

  async function handleLoad(id: string) {
    setBusy("load");
    const res = await loadPlay(id);
    setBusy(null);
    if (res.error || !res.data) { setNotice(res.error ?? "Could not load play."); return; }
    const d = res.data as Partial<BoardState & { frames: Frame[]; homeFormationId: string; awayFormationId: string }>;
    snapshot();
    setState({ tokens: d.tokens ?? [], shapes: d.shapes ?? [] });
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
    setNotice(`Loaded "${res.name}".`);
  }

  /** Load a pre-built pattern onto the board as a starting point. */
  function loadTemplate(id: string) {
    const tpl = PLAY_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    const { tokens, shapes, frames: tplFrames } = expandTemplate(tpl);
    snapshot();
    setState({ tokens: tokens as typeof state.tokens, shapes: shapes as typeof state.shapes });
    setFrames(tplFrames as typeof frames);
    setConceptIds([tpl.conceptId]);
    setCurrentPlayId(null);
    setPlayName(tpl.label);
    setDescription(null);
    setAnalysis(null);
    setVoiceUrl(null);
    setNotice("Template loaded — press Play under the pitch to watch it, then drag it about and save it as your own.");
  }

  async function handleDescribe() {
    setBusy("describe");
    setDescription(null);
    const res = await describePlay({
      playName: playName.trim(),
      ageGroup: team?.age_group ?? "U15",
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
      ageGroup: team?.age_group ?? "U15",
      opponentFormation: FORMATIONS.find((f) => f.id === awayFormationId)?.label ?? "unknown",
      ourFormation: FORMATIONS.find((f) => f.id === homeFormationId)?.label ?? "custom",
      summary: summariseBoard(),
      availableFormations: FORMATIONS.map((f) => `${f.label} (${f.format})`),
    });
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    setAnalysis(res.analysis ?? null);
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

    if (state.shapes.length) {
      lines.push("Lines drawn:");
      state.shapes.forEach((sh) => {
        const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
        const kind = sh.kind === "run" ? "a run" : sh.kind === "pass" ? "a pass" : sh.kind === "dribble" ? "a dribble" : "a freehand mark";
        lines.push(`- ${kind} from the ${side(a.x)} ${zone(a.y)} to the ${side(b.x)} ${zone(b.y)}`);
      });
    } else {
      lines.push("No runs or passes drawn.");
    }

    lines.push(frames.length >= 2
      ? `The play has ${frames.length} movement steps captured as a sequence.`
      : "No movement sequence captured.");

    return lines.join("\n");
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

  // ── Coordinates ────────────────────────────────────────────────
  function toBoard(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(2, Math.min(W - 2, ((clientX - rect.left) / rect.width) * W)),
      y: Math.max(2, Math.min(H - 2, ((clientY - rect.top) / rect.height) * H)),
    };
  }

  // ── Setup actions ──────────────────────────────────────────────
  function setUpHome() {
    const f = FORMATIONS.find((x) => x.id === homeFormationId)!;
    const assigned = assignToSlots(f, roster);
    snapshot();
    setState((st) => {
      // Only use the full pitch when we're the only team on the board.
      const vsOpponent = st.tokens.some((t) => t.kind === "opponent");
      return {
        ...st,
        tokens: [
          ...st.tokens.filter((t) => t.kind !== "player"),
          ...f.slots.map((slot, i) => {
            const p = assigned[i];
            const pos = vsOpponent ? compress(slot, "home") : slot;
            return {
              id: uid("h"),
              label: p ? shortLabel(p.full_name) : String(i + 1),
              x: pos.x, y: pos.y,
              kind: "player" as const,
              group: p ? groupOf(p.position) : groupOf(slot.role),
              playerId: p?.id,
            };
          }),
        ],
      };
    });
  }
  function setUpAway() {
    const f = FORMATIONS.find((x) => x.id === awayFormationId)!;
    const home = FORMATIONS.find((x) => x.id === homeFormationId)!;
    const assigned = assignToSlots(home, roster);
    snapshot();
    setState((st) => {
      const hadHome = st.tokens.some((t) => t.kind === "player");
      return {
        ...st,
        tokens: [
          ...st.tokens.filter((t) => t.kind !== "opponent" && t.kind !== "player"),
          // With both teams up, each side is compressed into its own half so
          // the shapes face each other instead of interleaving through midfield.
          ...(hadHome
            ? home.slots.map((slot, i) => {
                const p = assigned[i];
                const c = compress(slot, "home");
                return {
                  id: uid("h"),
                  label: p ? shortLabel(p.full_name) : String(i + 1),
                  x: c.x, y: c.y,
                  kind: "player" as const,
                  group: p ? groupOf(p.position) : groupOf(slot.role),
                  playerId: p?.id,
                };
              })
            : []),
          ...f.slots.map((slot, i) => {
            const c = compress(slot, "away");
            return {
              id: uid("a"),
              label: String(i + 1),
              x: c.x, y: c.y,
              kind: "opponent" as const,
              group: "Opponent",
            };
          }),
        ],
      };
    });
  }
  function placePlayer(p: BoardPlayer) {
    snapshot();
    setState((st) => ({
      ...st,
      tokens: [...st.tokens, {
        id: uid("h"), label: shortLabel(p.full_name), x: 50, y: 75,
        kind: "player", group: groupOf(p.position), playerId: p.id,
      }],
    }));
  }
  function addBall() {
    snapshot();
    setState((st) => ({
      ...st,
      tokens: [...st.tokens.filter((t) => t.kind !== "ball"), {
        id: uid("b"), label: "", x: 50, y: 75, kind: "ball", group: "Ball",
      }],
    }));
  }
  function addOpponent() {
    snapshot();
    setState((st) => ({
      ...st,
      tokens: [...st.tokens, {
        id: uid("a"), label: "", x: 50, y: 40, kind: "opponent", group: "Opponent",
      }],
    }));
  }
  function clearAll() {
    snapshot();
    setState({ tokens: [], shapes: [] });
  }
  function clearDrawings() {
    snapshot();
    setState((st) => ({ ...st, shapes: [] }));
  }

  // ── Pointer handling ───────────────────────────────────────────
  function onTokenDown(e: React.PointerEvent, tok: Token) {
    if (mode === "erase") {
      e.stopPropagation();
      snapshot();
      setState((st) => ({ ...st, tokens: st.tokens.filter((t) => t.id !== tok.id) }));
      return;
    }
    if (mode !== "move") return;
    e.stopPropagation();
    const { x, y } = toBoard(e.clientX, e.clientY);
    snapshot();
    drag.current = { id: tok.id, dx: tok.x - x, dy: tok.y - y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onSvgDown(e: React.PointerEvent) {
    if (mode === "move" || mode === "erase") return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    drawing.current = true;
    setDraft({ id: "draft", kind: mode, pts: [{ x, y }, { x, y }] });
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }
  function onSvgMove(e: React.PointerEvent) {
    if (drag.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      const d = drag.current;
      setState((st) => ({
        ...st,
        tokens: st.tokens.map((t) =>
          t.id === d.id
            ? { ...t, x: Math.max(2, Math.min(W - 2, x + d.dx)), y: Math.max(2, Math.min(H - 2, y + d.dy)) }
            : t
        ),
      }));
    } else if (drawing.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      setDraft((d) => {
        if (!d) return d;
        if (d.kind === "free") return { ...d, pts: [...d.pts, { x, y }] };
        return { ...d, pts: [d.pts[0], { x, y }] };
      });
    }
  }
  function onSvgUp() {
    drag.current = null;
    if (drawing.current && draft) {
      const a = draft.pts[0], b = draft.pts[draft.pts.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) > 3) {
        snapshot();
        const shape = { ...draft, id: uid("s") };
        setState((st) => ({ ...st, shapes: [...st.shapes, shape] }));
      }
    }
    drawing.current = false;
    setDraft(null);
  }
  function onShapeDown(e: React.PointerEvent, id: string) {
    if (mode !== "erase") return;
    e.stopPropagation();
    snapshot();
    setState((st) => ({ ...st, shapes: st.shapes.filter((s2) => s2.id !== id) }));
  }

  // ── Export ─────────────────────────────────────────────────────
  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(W * 8));
    clone.setAttribute("height", String(H * 8));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W * 8;
      canvas.height = H * 8;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${team?.name ?? "tactics"}-board.png`.replace(/\s+/g, "-").toLowerCase();
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  }

  // ── UI helpers ─────────────────────────────────────────────────
  const toolBtn = (m: Mode, Icon: typeof MousePointer2, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      title={label}
      className={`inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
        mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
  const formationSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <select
      id={id}
      aria-label="Formation"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {FORMATION_SIZES.map((size) => (
        <optgroup key={size} label={FORMATIONS.find((f) => f.size === size)!.format}>
          {FORMATIONS.filter((f) => f.size === size).map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  const shapeStroke: Record<ShapeKind, string> = {
    run: "#fde047", pass: "#fde047", dribble: "#38bdf8", free: "#f472b6",
  };
  function renderShape(sh: Shape, isDraft = false) {
    const stroke = shapeStroke[sh.kind];
    const common = {
      stroke, strokeWidth: 1.2, fill: "none",
      strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
      opacity: isDraft ? 0.75 : 1,
      style: { cursor: mode === "erase" ? "pointer" : "default" },
      onPointerDown: isDraft ? undefined : (e: React.PointerEvent) => onShapeDown(e, sh.id),
    };
    const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
    if (sh.kind === "free") return <path key={sh.id} d={polyPath(sh.pts)} {...common} />;
    if (sh.kind === "dribble")
      return <path key={sh.id} d={dribblePath(a.x, a.y, b.x, b.y)} markerEnd="url(#tb-arrow)" {...common} />;
    return (
      <line
        key={sh.id}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        strokeDasharray={sh.kind === "pass" ? "3 2" : undefined}
        markerEnd="url(#tb-arrow)"
        {...common}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Team + formations */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your team</p>
          {teams.length > 1 && (
            <select
              value={teamId}
              aria-label="Team"
              onChange={(e) => {
                setTeamId(e.target.value);
                snapshot();
                setState((st) => ({ ...st, tokens: st.tokens.filter((t) => t.kind !== "player") }));
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.age_group ? ` · ${t.age_group}` : ""}</option>
              ))}
            </select>
          )}
          {formationSelect(homeFormationId, setHomeFormationId, "tb-home-formation")}
          <button
            type="button"
            onClick={setUpHome}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Users className="size-3.5" aria-hidden="true" />
            Set up my XI
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Opponent</p>
          {teams.length > 1 && <div className="h-[34px]" aria-hidden="true" />}
          {formationSelect(awayFormationId, setAwayFormationId, "tb-away-formation")}
          <button
            type="button"
            onClick={setUpAway}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-muted"
          >
            <Circle className="size-3.5" aria-hidden="true" />
            Set up opponent XI
          </button>
        </div>
      </div>

      {/* Tools */}
      <div className="flex flex-wrap items-center gap-1.5">
        {toolBtn("move", MousePointer2, "Move")}
        {toolBtn("run", ArrowUpRight, "Run")}
        {toolBtn("pass", Minus, "Pass")}
        {toolBtn("dribble", Waves, "Dribble")}
        {toolBtn("free", Pencil, "Draw")}
        {toolBtn("erase", Eraser, "Erase")}
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={addBall} title="Add ball" className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">⚽ Ball</button>
        <button type="button" onClick={addOpponent} title="Add one opponent" className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">
          <Circle className="size-3.5" aria-hidden="true" /> +1
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={undo} title="Undo" className="inline-flex h-10 sm:h-9 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted"><Undo2 className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={redo} title="Redo" className="inline-flex h-10 sm:h-9 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted"><Redo2 className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={() => setShowNames((v) => !v)} title="Toggle names" className={`inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border px-2.5 text-xs ${showNames ? "bg-muted border-border" : "bg-background border-border"} hover:bg-muted`}>
          <Tag className="size-3.5" aria-hidden="true" /> Names
        </button>
        <span className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background pl-2 pr-1 text-xs">
          <Grid3x3 className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <select
            value={overlay}
            onChange={(e) => setOverlay(e.target.value as Overlay)}
            aria-label="Pitch overlay"
            className="bg-transparent py-1 text-xs focus:outline-none"
          >
            <option value="none">No overlay</option>
            <option value="thirds">Thirds</option>
            <option value="channels">Channels &amp; half-spaces</option>
            <option value="zone14">Zone 14 &amp; cut-backs</option>
          </select>
        </span>
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={clearDrawings} className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">Clear lines</button>
        <button type="button" onClick={clearAll} className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">
          <RotateCcw className="size-3.5" aria-hidden="true" /> Reset
        </button>
        <button type="button" onClick={exportPng} className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted">
          <Download className="size-3.5 text-primary" aria-hidden="true" /> PNG
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        {/* Pitch */}
        <div className="mx-auto w-full max-w-md">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="h-full w-full touch-none select-none"
              onPointerDown={onSvgDown}
              onPointerMove={onSvgMove}
              onPointerUp={onSvgUp}
              onPointerLeave={onSvgUp}
            >
              <defs>
                <marker id="tb-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
                </marker>
                <pattern id="tb-stripe" width={100} height={12.5} patternUnits="userSpaceOnUse">
                  <rect width={100} height={12.5} fill="#15803d" />
                  <rect width={100} height={6.25} fill="#166f36" />
                </pattern>
              </defs>

              <rect x={0} y={0} width={W} height={H} fill="url(#tb-stripe)" />

              <OverlayLayer overlay={overlay} />

              {/* Markings */}
              <g stroke="rgba(255,255,255,0.55)" strokeWidth={0.5} fill="none">
                <rect x={2} y={2} width={W - 4} height={H - 4} rx={1} />
                <line x1={2} y1={H / 2} x2={W - 2} y2={H / 2} />
                <circle cx={W / 2} cy={H / 2} r={11} />
                <circle cx={W / 2} cy={H / 2} r={0.8} fill="rgba(255,255,255,0.55)" />
                <rect x={26} y={2} width={48} height={20} />
                <rect x={38} y={2} width={24} height={8} />
                <rect x={26} y={H - 22} width={48} height={20} />
                <rect x={38} y={H - 10} width={24} height={8} />
                <circle cx={W / 2} cy={16} r={0.8} fill="rgba(255,255,255,0.55)" />
                <circle cx={W / 2} cy={H - 16} r={0.8} fill="rgba(255,255,255,0.55)" />
              </g>

              {/* Shapes */}
              {view.shapes.map((sh) => renderShape(sh))}
              {draft && renderShape(draft, true)}

              {/* Tokens */}
              {view.tokens.map((tok) => (
                <g
                  key={tok.id}
                  transform={`translate(${tok.x} ${tok.y})`}
                  onPointerDown={(e) => onTokenDown(e, tok)}
                  style={{ cursor: mode === "move" ? "grab" : mode === "erase" ? "pointer" : "default" }}
                >
                  {tok.kind === "ball" ? (
                    <circle r={2.4} fill="#f8fafc" stroke="#111" strokeWidth={0.4} />
                  ) : (
                    <>
                      <circle
                        r={4.2}
                        fill={GROUP_COLOR[tok.group]}
                        stroke={tok.kind === "opponent" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.35)"}
                        strokeWidth={0.5}
                      />
                      {tok.kind === "opponent" && tok.label && (
                        <text y={1.2} textAnchor="middle" fontSize={3.4} fill="#fff" fontWeight="bold">{tok.label}</text>
                      )}
                      {tok.kind === "player" && showNames && tok.label && (
                        <text
                          y={7.6}
                          textAnchor="middle"
                          fontSize={3}
                          fill="#fff"
                          style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 0.5 }}
                        >
                          {tok.label}
                        </text>
                      )}
                    </>
                  )}
                </g>
              ))}
            </svg>
          </div>
          {/* Playback sits with the pitch — it is the first thing wanted after
              loading a template or drawing a play. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {playing ? (
              <button
                type="button"
                onClick={stopPlayback}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <Square className="size-4" aria-hidden="true" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => playAnimation()}
                disabled={state.tokens.length === 0}
                className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Play className="size-4" aria-hidden="true" /> Play the move
              </button>
            )}
            {frames.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {frames.length} step{frames.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            {mode === "move" && "Drag players, opponents and the ball to position them."}
            {mode === "run" && "Drag to draw a run (solid arrow)."}
            {mode === "pass" && "Drag to draw a pass (dashed arrow)."}
            {mode === "dribble" && "Drag to draw a dribble (wavy line)."}
            {mode === "free" && "Draw freehand to sketch a zone or shape."}
            {mode === "erase" && "Tap a player or a line to remove it."}
          </p>
        </div>

        {/* Bench + legend */}
        <div className="space-y-4">
          {/* ── Animation ─────────────────────────────────────── */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Film className="size-3.5 text-primary" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Play sequence
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Draw runs and passes and press Play — the players follow your arrows. For finer control, capture steps by hand.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={captureFrame} disabled={playing} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50">
                <Plus className="size-3" aria-hidden="true" /> Capture step
              </button>
              {playing ? (
                <button type="button" onClick={stopPlayback} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground">
                  <Square className="size-3" aria-hidden="true" /> Stop
                </button>
              ) : (
                <button type="button" onClick={() => playAnimation()} disabled={state.tokens.length === 0} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                  <Play className="size-3" aria-hidden="true" /> Play
                </button>
              )}
              <button
                type="button"
                onClick={recordAnimation}
                disabled={state.tokens.length === 0 || playing || recording}
                title="Record the sequence as a video"
                className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
              >
                <Video className="size-3 text-primary" aria-hidden="true" />
                {recording ? "Recording…" : "Record"}
              </button>
              {frames.length > 0 && (
                <button type="button" onClick={() => setFrames([])} disabled={playing || recording} className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50">
                  Clear
                </button>
              )}
            </div>
            {frames.length === 0 ? (
              <p className="text-xs text-muted-foreground">No steps captured yet.</p>
            ) : (
              <ol className="space-y-1">
                {frames.map((f, i) => (
                  <li key={f.id} className="flex items-center gap-1.5">
                    <button type="button" onClick={() => gotoFrame(i)} disabled={playing} className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50">
                      Step {i + 1}
                    </button>
                    <button type="button" onClick={() => updateFrame(i)} disabled={playing} title="Update this step to the current board" className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] hover:bg-muted disabled:opacity-50">Set</button>
                    <button type="button" onClick={() => deleteFrame(i)} disabled={playing} title="Delete step" className="rounded-md border border-border bg-background px-2 py-2 sm:py-1 hover:bg-muted disabled:opacity-50">
                      <Trash2 className="size-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* ── Saved plays ───────────────────────────────────── */}
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
            <VoiceNoteRecorder playId={currentPlayId} initialUrl={voiceUrl} onChange={setVoiceUrl} />

            {description && (
              <div className="rounded-md border border-border bg-background p-2 space-y-1 max-h-56 overflow-y-auto">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Coaching points</p>
                  <SpeakButton text={description} />
                </div>
                {description.trim().split("\n").filter(Boolean).map((l, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{l}</p>
                ))}
              </div>
            )}

            {analysis && (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-2 space-y-1 max-h-56 overflow-y-auto">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Countering the opponent</p>
                  <SpeakButton text={analysis} />
                </div>
                {analysis.trim().split("\n").filter(Boolean).map((l, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{l}</p>
                ))}
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

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Bench {bench.length > 0 && `(${bench.length})`}
            </p>
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">This team has no players yet. Add players in the Squad tab.</p>
            ) : bench.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone&apos;s on the pitch.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {bench.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => placePlayer(p)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    <span className="inline-block size-2 rounded-full" style={{ background: GROUP_COLOR[groupOf(p.position)] }} />
                    {shortLabel(p.full_name)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Legend</p>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {["Goalkeeper", "Defender", "Midfielder", "Forward", "Opponent"].map((g) => (
                <div key={g} className="flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-full" style={{ background: GROUP_COLOR[g] }} />
                  {g}
                </div>
              ))}
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5" style={{ background: "#fde047" }} /> Run</div>
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5" style={{ backgroundImage: "repeating-linear-gradient(to right,#fde047 0 3px,transparent 3px 6px)" }} /> Pass</div>
                <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5" style={{ background: "#38bdf8" }} /> Dribble</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
