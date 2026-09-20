"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MousePointer2, Eraser, Undo2, Redo2, RotateCcw, Users, Circle,
  ArrowUpRight, Minus, Waves, Pencil, Download, Tag, Grid3x3,
  Play, Square, Plus, Save, FolderOpen, Send, Trash2, Film, Video, Sparkles, Swords,
  ChevronUp, ChevronDown, Copy, Target, MessageSquare,
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
import {
  BOARD_W, BOARD_H, dribblePath, polyPath, shapeColor, interpolateFrames, totalDurationMs, DEFAULT_FRAME_DURATION_MS,
  getPitch, PITCHES, toBoardSpace, EQUIPMENT_SPECS, resolveSpotlightCenter, RECORDABLE_SHAPE_KINDS,
  GROUP_COLOR,
  type EquipmentKind, type BoardObject, type PlayerNote,
  type Token, type Shape, type ShapeKind, type Frame as ModelFrame,
} from "@/lib/board-model";
import { PitchLayer } from "@/components/tactics/pitch-layer";
import { EquipmentLayer } from "@/components/tactics/equipment-layer";

// ── Types ────────────────────────────────────────────────────────
// Token, Shape, ShapeKind and the Frame shape all come from board-model.ts
// now — the one place they're defined, shared with the read-only viewer and
// the canvas recorder. This board's own drawing tools produce
// run/pass/dribble/free/spotlight; zone/text exist in the shared ShapeKind
// for the film board's tools (components/tactics/film-board.tsx), not this
// one — RECORDABLE_SHAPE_KINDS is what actually gates what the canvas
// recorder here can draw, not this board's own tool set.
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
interface BoardState {
  tokens: Token[];
  shapes: Shape[];
  /** Placed training equipment — new, additive. A play saved before this
   * existed has none, and every reader treats that the same as []. */
  objects: BoardObject[];
  /** Coach notes about individual players — new, additive, same reasoning
   * as objects above. */
  playerNotes: PlayerNote[];
}
type Mode = "move" | "run" | "pass" | "dribble" | "free" | "spotlight" | "erase";

/** A captured-but-not-yet-committed undo entry — see captureSnapshot()/
 * commitSnapshot() below. */
interface SnapshotEntry {
  state: BoardState;
  pitch: string;
  frames: Frame[];
}

/**
 * Every modelled pitch is offered in the switcher. Half-pitch and
 * attacking-third were held back in an earlier pass over a clipping risk —
 * a full-XI formation placed near a deep position could render outside a
 * cropped viewBox — but that's now resolved at the source: both are marked
 * `supportsFormations: false` in board-model.ts, so "Set up my XI" is
 * disabled there exactly like it already is on a training grid, and manual
 * placement centres on the pitch actually showing (see placePlayer/
 * addBall/addOpponent). Nothing here still needs the visual check that
 * held them back — it needs one anyway before real use, same as everything
 * else in this file that can't be rendered in this environment.
 */
const SWITCHABLE_PITCHES = PITCHES;

/** One step of a play: where every token sits, plus the lines drawn at that step. */
type Frame = ModelFrame;
type Overlay = "none" | "thirds" | "channels" | "zone14";

// ── Pitch geometry (attacking upward) ────────────────────────────
const W = BOARD_W;
const H = BOARD_H;

const GROUP_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Forward"];

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

export function TacticalBoard({ teams }: { teams: BoardTeam[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [homeFormationId, setHomeFormationId] = useState("11-4-3-3");
  const [awayFormationId, setAwayFormationId] = useState("11-4-4-2");
  const [mode, setMode] = useState<Mode>("move");
  const [showNames, setShowNames] = useState(true);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [pitchId, setPitchIdState] = useState("full");
  const [equipmentKind, setEquipmentKind] = useState<EquipmentKind>("cone");

  const [state, setState] = useState<BoardState>({ tokens: [], shapes: [], objects: [], playerNotes: [] });
  const [draft, setDraft] = useState<Shape | null>(null);

  // Animation
  const [frames, setFrames] = useState<Frame[]>([]);
  const [playing, setPlaying] = useState(false);
  // Scrub preview: dragging the timeline sets `anim` to the interpolated
  // pose at that instant (read-only preview), exactly like playback does —
  // it never touches `state`/undo history. To actually edit a step's pose,
  // jump to it with gotoFrame(), which does commit to state.
  const [scrubMs, setScrubMs] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [recording, setRecording] = useState(false);
  // Equipment doesn't move during playback, so the animated snapshot only
  // ever carries tokens/shapes — objects always come from live state.
  const [anim, setAnim] = useState<Pick<BoardState, "tokens" | "shapes"> | null>(null);
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
  // Tapping a player selects them; tapping a bench player then swaps the two.
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const stateRef = useRef(state);
  stateRef.current = state;
  const pitchIdRef = useRef(pitchId);
  pitchIdRef.current = pitchId;
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const past = useRef<BoardState[]>([]);
  const future = useRef<BoardState[]>([]);
  const pastPitch = useRef<string[]>([]);
  const futurePitch = useRef<string[]>([]);
  const pastFrames = useRef<Frame[][]>([]);
  const futureFrames = useRef<Frame[][]>([]);
  const [, forceRender] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean; pending: SnapshotEntry } | null>(null);
  const dragObj = useRef<{ id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean; pending: SnapshotEntry } | null>(null);
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
  const view = anim ? { ...state, tokens: anim.tokens, shapes: anim.shapes } : state;

  const pitch = getPitch(pitchId);

  // ── History ────────────────────────────────────────────────────
  // pastPitch/futurePitch and pastFrames/futureFrames track the pitch id
  // and the captured-steps timeline alongside each board snapshot, in
  // lockstep with past/future, so switching pitches (which clears the
  // board — see setPitch below) and every timeline edit (capture/reorder/
  // duplicate/insert/delete/duration — see captureFrame() etc. below,
  // which all call this first) are single undoable steps like any other
  // edit, not state that sits outside undo/redo entirely.
  /** Captures the pre-edit state without pushing it to history yet — used
   * by a drag (token/equipment) that snapshots on pointer-down but should
   * only actually cost a history entry if the pointer really moves. A tap
   * that only selects/substitutes a player used to snapshot unconditionally
   * on down, so a few taps could evict real history under the 40-entry cap
   * with nothing to undo for them. */
  function captureSnapshot(): SnapshotEntry {
    return {
      state: JSON.parse(JSON.stringify(stateRef.current)) as BoardState,
      pitch: pitchIdRef.current,
      frames: JSON.parse(JSON.stringify(framesRef.current)) as Frame[],
    };
  }
  function commitSnapshot(entry: SnapshotEntry) {
    past.current.push(entry.state);
    pastPitch.current.push(entry.pitch);
    pastFrames.current.push(entry.frames);
    if (past.current.length > 40) { past.current.shift(); pastPitch.current.shift(); pastFrames.current.shift(); }
    future.current = [];
    futurePitch.current = [];
    futureFrames.current = [];
  }
  function snapshot() {
    commitSnapshot(captureSnapshot());
  }
  function undo() {
    const prev = past.current.pop();
    const prevPitch = pastPitch.current.pop();
    const prevFrames = pastFrames.current.pop();
    if (!prev) return;
    future.current.push(JSON.parse(JSON.stringify(stateRef.current)) as BoardState);
    futurePitch.current.push(pitchIdRef.current);
    futureFrames.current.push(JSON.parse(JSON.stringify(framesRef.current)) as Frame[]);
    setState(prev);
    if (prevPitch) setPitchIdState(prevPitch);
    if (prevFrames) setFrames(prevFrames);
    forceRender((n) => n + 1);
  }
  function redo() {
    const next = future.current.pop();
    const nextPitch = futurePitch.current.pop();
    const nextFrames = futureFrames.current.pop();
    if (!next) return;
    past.current.push(JSON.parse(JSON.stringify(stateRef.current)) as BoardState);
    pastPitch.current.push(pitchIdRef.current);
    pastFrames.current.push(JSON.parse(JSON.stringify(framesRef.current)) as Frame[]);
    setState(next);
    if (nextPitch) setPitchIdState(nextPitch);
    if (nextFrames) setFrames(nextFrames);
    forceRender((n) => n + 1);
  }

  // ── Animation ──────────────────────────────────────────────────
  // Every one of these snapshots first — frame edits used to sit entirely
  // outside undo/redo, so reordering, deleting, or clearing a hand-built
  // timeline had no way back.
  function captureFrame() {
    snapshot();
    const f: Frame = {
      id: uid("f"),
      tokens: state.tokens.map((t) => ({ id: t.id, x: t.x, y: t.y })),
      shapes: JSON.parse(JSON.stringify(state.shapes)) as Shape[],
    };
    setFrames((fs) => [...fs, f]);
    setNotice(`Step ${frames.length + 1} captured.`);
  }
  function updateFrame(i: number) {
    snapshot();
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
    snapshot();
    setFrames((fs) => fs.filter((_, idx) => idx !== i));
  }
  /** Swap a step with its neighbour — the reorder control on the timeline. */
  function moveFrame(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= frames.length) return; // out of range — nothing to snapshot
    snapshot();
    setFrames((fs) => {
      const next = [...fs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  /** Copy a step in place, right after itself — a quick way to hold a pose
   * longer (duplicate, then shorten the original's duration to 0 or leave
   * both) or to start editing a variation without losing the original. */
  function duplicateFrame(i: number) {
    if (!frames[i]) return;
    snapshot();
    setFrames((fs) => {
      const src = fs[i];
      if (!src) return fs;
      const copy: Frame = { ...src, id: uid("f") };
      return [...fs.slice(0, i + 1), copy, ...fs.slice(i + 1)];
    });
  }
  /** Capture the board's current live pose as a new step inserted right
   * after index i, rather than always appended at the end like
   * captureFrame(). */
  function insertFrameAfter(i: number) {
    snapshot();
    const f: Frame = {
      id: uid("f"),
      tokens: state.tokens.map((t) => ({ id: t.id, x: t.x, y: t.y })),
      shapes: JSON.parse(JSON.stringify(state.shapes)) as Shape[],
    };
    setFrames((fs) => [...fs.slice(0, i + 1), f, ...fs.slice(i + 1)]);
    setNotice(`Step inserted after ${i + 1}.`);
  }
  // Deliberately not snapshotted, unlike the structural edits above: this
  // fires on every keystroke of the duration input, and snapshotting per
  // keystroke would flood the 40-entry undo history in a few seconds of
  // typing. A mistyped duration is trivially re-typed; it doesn't need undo
  // the way a deleted or reordered step does.
  function setFrameDuration(i: number, ms: number) {
    setFrames((fs) => fs.map((f, idx) => (idx === i ? { ...f, durationMs: Math.max(100, ms) } : f)));
  }
  function setFrameEase(i: number, ease: NonNullable<Frame["ease"]>) {
    setFrames((fs) => fs.map((f, idx) => (idx === i ? { ...f, ease } : f)));
  }
  /** Jump the board to a stored step so the coach can edit it. */
  function gotoFrame(i: number) {
    const f = frames[i];
    if (!f) return;
    snapshot();
    setState((st) => ({
      ...st,
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
    setScrubbing(false);
    setAnim(null);
  }

  /** Preview the pose at an exact point in the sequence without touching
   * live state — dragging the scrub bar calls this on every move. */
  function scrubTo(ms: number) {
    if (frames.length < 2) return;
    stopPlayback();
    setScrubbing(true);
    setScrubMs(ms);
    const { tokens, shapes } = interpolateFrames(state.tokens, frames, ms);
    setAnim({ tokens, shapes });
  }
  /** Release the scrub bar — return to the live, editable board. */
  function endScrub() {
    setScrubbing(false);
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

    // Stepping/easing come from interpolateFrames() in board-model.ts — the
    // same function the video recorder and the read-only player-facing
    // viewer use, so a fix to the maths reaches all three instead of one.
    const total = totalDurationMs(seqFrames);
    // The timestamp a rAF callback receives is when that frame began, which can
    // predate a performance.now() taken in the click handler. That made elapsed
    // negative, seg -1, and seqFrames[-1] undefined — the callback threw on its
    // first frame and playback silently died. Take the clock from the first tick.
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = Math.max(0, now - start);
      const clamped = Math.min(elapsed, total);
      const { tokens, shapes } = interpolateFrames(state.tokens, seqFrames, clamped);

      setAnim({ tokens, shapes });

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
    // drawBoard() (board-render.ts) always paints the fixed full-pitch
    // background — it has no idea a training grid exists — so recording on
    // one would silently composite the wrong surface behind the drill.
    // Rather than ship that mismatch, video export stays full-pitch-only
    // until the canvas recorder is taught about Pitch too.
    if (!pitch.supportsFormations) {
      setNotice("Video recording is only available on the full pitch for now — export a PNG instead.");
      return;
    }
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

    // Same interpolateFrames() as playAnimation() and the shared viewer use
    // — the recording now matches on-screen playback exactly, including any
    // per-step timing a future timeline editor sets.
    const total = totalDurationMs(seqFrames);
    let startedAt: number | null = null;

    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (startedAt === null) startedAt = now;
        const elapsed = Math.min(Math.max(0, now - startedAt), total);
        const { tokens, shapes } = interpolateFrames(state.tokens, seqFrames, elapsed);
        // drawBoard() has no polygon/text rendering (see RECORDABLE_SHAPE_KINDS)
        // — a zone or a label would draw as a stray line without this filter.
        const recordable = shapes.filter((sh) => RECORDABLE_SHAPE_KINDS.has(sh.kind));

        drawBoard(ctx, { tokens, shapes: recordable, overlay, showNames, scale });

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
    const res = await listPlays(id, "pitch");
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
      data: { tokens: state.tokens, shapes: state.shapes, objects: state.objects, playerNotes: state.playerNotes, pitchId, frames, homeFormationId, awayFormationId },
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
    const d = res.data as Partial<BoardState & { frames: Frame[]; homeFormationId: string; awayFormationId: string; pitchId: string }>;
    snapshot();
    setState({ tokens: d.tokens ?? [], shapes: d.shapes ?? [], objects: d.objects ?? [], playerNotes: d.playerNotes ?? [] });
    setPitchIdState(d.pitchId ?? "full");
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
    setState({ tokens: tokens as typeof state.tokens, shapes: shapes as typeof state.shapes, objects: [], playerNotes: [] });
    setPitchIdState("full");
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
  // Clamped to the *current* pitch's dimensions, not the fixed 100×150 —
  // the SVG's viewBox below tracks the same pitch, so this always matches
  // what's actually visible.
  function toBoard(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return toBoardSpace(rect, clientX, clientY, pitch.w, pitch.h);
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
  /**
   * Swap a bench player for the selected player on the pitch. The replacement
   * inherits the exact spot, which is what a coach means by a substitution —
   * the shape stays, the person changes.
   */
  function substitute(incoming: BoardPlayer) {
    const outgoing = state.tokens.find((t) => t.id === selectedTokenId);
    if (!outgoing) return;
    snapshot();
    setState((st) => ({
      ...st,
      tokens: st.tokens.map((t) =>
        t.id === outgoing.id
          ? {
              ...t,
              id: uid("h"),
              label: shortLabel(incoming.full_name),
              group: groupOf(incoming.position),
              playerId: incoming.id,
            }
          : t
      ),
    }));
    setSelectedTokenId(null);
    setNotice(`${shortLabel(incoming.full_name)} on for ${outgoing.label}.`);
  }

  function placePlayer(p: BoardPlayer) {
    snapshot();
    setState((st) => ({
      ...st,
      tokens: [...st.tokens, {
        id: uid("h"), label: shortLabel(p.full_name), x: pitch.w / 2, y: pitch.h / 2,
        kind: "player", group: groupOf(p.position), playerId: p.id,
      }],
    }));
  }
  function addBall() {
    snapshot();
    setState((st) => ({
      ...st,
      tokens: [...st.tokens.filter((t) => t.kind !== "ball"), {
        id: uid("b"), label: "", x: pitch.w / 2, y: pitch.h / 2, kind: "ball", group: "Ball",
      }],
    }));
  }
  function addOpponent() {
    snapshot();
    setState((st) => ({
      ...st,
      tokens: [...st.tokens, {
        // Placed higher up than centre, same 40/150 ratio the full pitch
        // always used — keeps an added opponent visually "further away"
        // on any pitch instead of landing on top of the ball at centre.
        id: uid("a"), label: "", x: pitch.w / 2, y: pitch.h * (40 / 150), kind: "opponent", group: "Opponent",
      }],
    }));
  }
  function clearAll() {
    snapshot();
    setState({ tokens: [], shapes: [], objects: [], playerNotes: [] });
  }
  function clearDrawings() {
    snapshot();
    setState((st) => ({ ...st, shapes: [] }));
  }
  function addEquipment(kind: EquipmentKind) {
    snapshot();
    setState((st) => ({
      ...st,
      objects: [...st.objects, { id: uid("o"), kind, x: pitch.w / 2, y: pitch.h / 2 }],
    }));
  }
  /**
   * A note about one player. Kept general rather than pinned to a step —
   * the frameId field exists in the model for a future per-step version,
   * but this pass keeps it simple: one running set of notes per player
   * about this play, shown to them in the shared player-facing view.
   */
  function addPlayerNote(playerId: string, body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    snapshot();
    setState((st) => ({
      ...st,
      playerNotes: [...st.playerNotes, { id: uid("n"), playerId, frameId: null, body: trimmed }],
    }));
  }
  function deletePlayerNote(id: string) {
    snapshot();
    setState((st) => ({ ...st, playerNotes: st.playerNotes.filter((n) => n.id !== id) }));
  }
  /**
   * Switches which Pitch is painted behind the board. Full/half/third-style
   * pitches and the training grids are genuinely different coordinate
   * spaces (see SWITCHABLE_PITCHES above) — a token placed near a deep
   * position on the full pitch would sit off the edge of a 60×60 grid, so
   * rather than leave tokens somewhere invisible, switching clears the
   * board. One undo (Ctrl/Cmd+Z equivalent, the Undo button) brings
   * everything back exactly as it was.
   */
  function setPitch(id: string) {
    if (id === pitchId) return;
    stopPlayback();
    snapshot();
    setState({ tokens: [], shapes: [], objects: [], playerNotes: [] });
    setPitchIdState(id);
    setFrames([]);
    setNotice("Switched pitch — the board was cleared for the new surface. Undo to get it back.");
  }

  // ── Pointer handling ───────────────────────────────────────────
  function onTokenDown(e: React.PointerEvent, tok: Token) {
    if (mode === "erase") {
      e.stopPropagation();
      snapshot();
      setState((st) => ({ ...st, tokens: st.tokens.filter((t) => t.id !== tok.id) }));
      return;
    }
    if (mode === "spotlight") {
      // Bound by playerId, not by this token's own id or the clicked point —
      // resolveSpotlightCenter() (board-model.ts) then draws the ring at
      // wherever that player currently is, every frame, including after a
      // substitution changes their token id. stopPropagation() happens
      // before the early return: without it, tapping the ball or an
      // opponent (neither has a playerId) let the event bubble to
      // onSvgDown, which had no spotlight guard of its own and created an
      // *unbound* spotlight at that point — and since the toggle-off check
      // below matches on playerId, a second such tap deleted every unbound
      // spotlight on the board at once.
      e.stopPropagation();
      if (!tok.playerId) return;
      const { x, y } = toBoard(e.clientX, e.clientY);
      drawing.current = true;
      setDraft({ id: "draft", kind: "spotlight", pts: [{ x: tok.x, y: tok.y }, { x, y }], playerId: tok.playerId });
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    if (mode !== "move") return;
    e.stopPropagation();
    const { x, y } = toBoard(e.clientX, e.clientY);
    // Captured now (so it reflects the true pre-drag position) but not
    // committed to history until onSvgMove confirms real movement —
    // otherwise a tap that only selects/substitutes a player (see onSvgUp)
    // pushed an identical, useless history entry every time, which could
    // evict real edits once the 40-entry cap was reached.
    drag.current = { id: tok.id, dx: tok.x - x, dy: tok.y - y, startX: x, startY: y, moved: false, pending: captureSnapshot() };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onSvgDown(e: React.PointerEvent) {
    // Spotlight only ever makes sense bound to a player — see onTokenDown,
    // which is the only place a spotlight draft is created. A background
    // (or ball/opponent) tap in this mode does nothing, rather than
    // creating an unbound ring with no playerId to follow.
    if (mode === "move" || mode === "erase" || mode === "spotlight") return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    drawing.current = true;
    setDraft({ id: "draft", kind: mode, pts: [{ x, y }, { x, y }] });
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }
  function onSvgMove(e: React.PointerEvent) {
    if (drag.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      const d = drag.current;
      if (!d.moved && Math.hypot(x - d.startX, y - d.startY) > 1.5) {
        // First real movement past the tap threshold — this is the moment
        // the pre-drag snapshot captured at pointer-down actually becomes
        // a real, undoable edit.
        d.moved = true;
        commitSnapshot(d.pending);
      }
      setState((st) => ({
        ...st,
        tokens: st.tokens.map((t) =>
          t.id === d.id
            ? { ...t, x: Math.max(2, Math.min(pitch.w - 2, x + d.dx)), y: Math.max(2, Math.min(pitch.h - 2, y + d.dy)) }
            : t
        ),
      }));
    } else if (dragObj.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      const d = dragObj.current;
      if (!d.moved && Math.hypot(x - d.startX, y - d.startY) > 1.5) {
        d.moved = true;
        commitSnapshot(d.pending);
      }
      setState((st) => ({
        ...st,
        objects: st.objects.map((o) =>
          o.id === d.id
            ? { ...o, x: Math.max(2, Math.min(pitch.w - 2, x + d.dx)), y: Math.max(2, Math.min(pitch.h - 2, y + d.dy)) }
            : o
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
    if (drag.current && !drag.current.moved) {
      const tapped = drag.current.id;
      const tok = state.tokens.find((t) => t.id === tapped);
      setSelectedTokenId(
        tok && tok.kind === "player" ? (tapped === selectedTokenId ? null : tapped) : null
      );
    }
    drag.current = null;
    dragObj.current = null;
    if (drawing.current && draft) {
      const a = draft.pts[0], b = draft.pts[draft.pts.length - 1];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (draft.kind === "spotlight") {
        // A plain click (no drag) still creates a usable ring at a sensible
        // default radius — dragging just lets a coach size it bigger.
        snapshot();
        const shape: Shape = { id: uid("s"), kind: "spotlight", pts: [a], playerId: draft.playerId, radius: Math.max(4, dist) };
        setState((st) => {
          // One spotlight per player: clicking an already-spotlighted
          // player again toggles it off rather than stacking rings.
          const already = st.shapes.some((s) => s.kind === "spotlight" && s.playerId === draft.playerId);
          return {
            ...st,
            shapes: already
              ? st.shapes.filter((s) => !(s.kind === "spotlight" && s.playerId === draft.playerId))
              : [...st.shapes, shape],
          };
        });
      } else if (dist > 3) {
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
  function onObjectDown(e: React.PointerEvent, obj: BoardObject) {
    if (mode === "erase") {
      e.stopPropagation();
      snapshot();
      setState((st) => ({ ...st, objects: st.objects.filter((o) => o.id !== obj.id) }));
      return;
    }
    if (mode !== "move") return;
    e.stopPropagation();
    const { x, y } = toBoard(e.clientX, e.clientY);
    // Same lazy-commit pattern as onTokenDown above.
    dragObj.current = { id: obj.id, dx: obj.x - x, dy: obj.y - y, startX: x, startY: y, moved: false, pending: captureSnapshot() };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  // ── Export ─────────────────────────────────────────────────────
  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    // Scaled off the *current* pitch's own dimensions, not the fixed
    // 100×150 — otherwise a training grid (e.g. 60×80) exported at a fixed
    // 800×1200 raster would come out letterboxed instead of filling the
    // frame. exportPng serialises the live SVG (which PitchLayer already
    // draws correctly for any pitch), so this is the only place that
    // needed to change.
    const pngW = pitch.w * 8, pngH = pitch.h * 8;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(pngW));
    clone.setAttribute("height", String(pngH));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pngW;
      canvas.height = pngH;
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

  function renderShape(sh: Shape, isDraft = false) {
    const stroke = shapeColor(sh);
    const common = {
      stroke, strokeWidth: 1.2, fill: "none",
      strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
      opacity: isDraft ? 0.75 : 1,
      style: { cursor: mode === "erase" ? "pointer" : "default" },
      onPointerDown: isDraft ? undefined : (e: React.PointerEvent) => onShapeDown(e, sh.id),
    };
    const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
    if (sh.kind === "spotlight") {
      // Centre comes from the live/animated token bound by playerId, not
      // from the shape's own stored point — see resolveSpotlightCenter().
      const c = resolveSpotlightCenter(sh, view.tokens) ?? a;
      const r = isDraft ? Math.max(4, Math.hypot(b.x - a.x, b.y - a.y)) : (sh.radius ?? 8);
      return <circle key={sh.id} cx={c.x} cy={c.y} r={r} strokeDasharray="1.5 1.2" {...common} />;
    }
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
                // Without this, the next Save updates the *previous*
                // team's play row with the new team's board content —
                // savePlay()'s update path has no team check of its own,
                // it trusts playId. A fresh team means a fresh play.
                setCurrentPlayId(null);
                setPlayName("");
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
            disabled={!pitch.supportsFormations}
            title={pitch.supportsFormations ? undefined : "Formations need the full pitch — switch pitch below"}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
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
            disabled={!pitch.supportsFormations}
            title={pitch.supportsFormations ? undefined : "Formations need the full pitch — switch pitch below"}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Circle className="size-3.5" aria-hidden="true" />
            Set up opponent XI
          </button>
        </div>
      </div>

      {/* Pitch */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Surface</p>
        <div className="flex flex-wrap gap-1.5">
          {SWITCHABLE_PITCHES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPitch(p.id)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium ${
                pitchId === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {!pitch.supportsFormations && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            A training grid — formations and pitch overlays are off. Place equipment and draw the drill.
          </p>
        )}
      </div>

      {/* Tools */}
      <div className="flex flex-wrap items-center gap-1.5">
        {toolBtn("move", MousePointer2, "Move")}
        {toolBtn("run", ArrowUpRight, "Run")}
        {toolBtn("pass", Minus, "Pass")}
        {toolBtn("dribble", Waves, "Dribble")}
        {toolBtn("free", Pencil, "Draw")}
        {toolBtn("spotlight", Target, "Spotlight")}
        {toolBtn("erase", Eraser, "Erase")}
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={addBall} title="Add ball" className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">⚽ Ball</button>
        <button type="button" onClick={addOpponent} title="Add one opponent" className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">
          <Circle className="size-3.5" aria-hidden="true" /> +1
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        <span className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background pl-2 pr-1 text-xs">
          <select
            value={equipmentKind}
            onChange={(e) => setEquipmentKind(e.target.value as EquipmentKind)}
            aria-label="Equipment"
            className="bg-transparent py-1 text-xs focus:outline-none"
          >
            {Object.values(EQUIPMENT_SPECS).map((spec) => (
              <option key={spec.kind} value={spec.kind}>{spec.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addEquipment(equipmentKind)}
            title="Add equipment"
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs hover:bg-muted"
          >
            <Plus className="size-3.5" aria-hidden="true" /> Add
          </button>
        </span>
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
          {/* Aspect ratio driven off the *current* pitch, not a hardcoded
              2:3 — a training grid or half/third pitch has a different
              shape, and the viewBox below always matches pitch.w/pitch.h.
              A mismatch here isn't just cosmetic letterboxing: toBoard()
              assumes the viewBox fills this box exactly, so a wrong ratio
              also means every click lands at the wrong coordinate. */}
          <div className="w-full overflow-hidden rounded-xl border border-border" style={{ aspectRatio: `${pitch.w} / ${pitch.h}` }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${pitch.w} ${pitch.h}`}
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
              </defs>

              <PitchLayer pitch={pitch} stripeId="tb-stripe" />

              {pitch.supportsFormations && <OverlayLayer overlay={overlay} />}

              {/* Shapes */}
              {view.shapes.map((sh) => renderShape(sh))}
              {draft && renderShape(draft, true)}

              {/* Equipment */}
              <EquipmentLayer objects={view.objects} onPointerDown={onObjectDown} />

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
                      {tok.id === selectedTokenId && (
                        <circle r={6} fill="none" stroke="#fff" strokeWidth={0.9} strokeDasharray="1.5 1.2" />
                      )}
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
            {mode === "spotlight" && "Tap a player to highlight them — it follows them through every frame. Tap again to remove."}
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
                disabled={state.tokens.length === 0 || playing || recording || !pitch.supportsFormations}
                title={pitch.supportsFormations ? "Record the sequence as a video" : "Video recording needs the full pitch"}
                className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
              >
                <Video className="size-3 text-primary" aria-hidden="true" />
                {recording ? "Recording…" : "Record"}
              </button>
              {frames.length > 0 && (
                <button
                  type="button"
                  // Frame edits are now folded into the same undo/redo
                  // history as tokens/shapes/objects (see snapshot()), so
                  // this is one Undo away like every other destructive
                  // action on the board — no separate confirm needed.
                  onClick={() => { snapshot(); setFrames([]); }}
                  disabled={playing || recording}
                  className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>

            {frames.length >= 2 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={totalDurationMs(frames)}
                    step={10}
                    value={scrubMs}
                    onChange={(e) => scrubTo(Number(e.target.value))}
                    onPointerUp={endScrub}
                    disabled={playing}
                    aria-label="Scrub the sequence"
                    className="flex-1 accent-primary disabled:opacity-50"
                  />
                  {/* A pointer drag ends preview on release (onPointerUp
                      above), but arrow-key/Home/End interaction with the
                      slider never fires a pointer event at all — without
                      this, a keyboard user had no way back to the live,
                      editable board once they'd touched the scrub bar. */}
                  {scrubbing && (
                    <button
                      type="button"
                      onClick={endScrub}
                      className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] hover:bg-muted"
                    >
                      Done previewing
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {scrubbing ? "Previewing — drag to scrub, editing a pose needs Step ▸ below." : "Drag to preview the sequence at any point."}
                </p>
              </div>
            )}

            {frames.length === 0 ? (
              <p className="text-xs text-muted-foreground">No steps captured yet.</p>
            ) : (
              <ol className="space-y-1">
                {frames.map((f, i) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background/50 p-1.5">
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveFrame(i, -1)} disabled={playing || i === 0} title="Move earlier" className="rounded px-0.5 hover:bg-muted disabled:opacity-30">
                        <ChevronUp className="size-3" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => moveFrame(i, 1)} disabled={playing || i === frames.length - 1} title="Move later" className="rounded px-0.5 hover:bg-muted disabled:opacity-30">
                        <ChevronDown className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                    <button type="button" onClick={() => gotoFrame(i)} disabled={playing} className="flex-1 min-w-[4rem] rounded-md border border-border bg-background px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50">
                      Step {i + 1}
                    </button>
                    {i > 0 && (
                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <input
                          type="number"
                          min={100}
                          step={100}
                          value={f.durationMs ?? DEFAULT_FRAME_DURATION_MS}
                          onChange={(e) => setFrameDuration(i, Number(e.target.value))}
                          disabled={playing}
                          aria-label={`Step ${i + 1} duration in milliseconds`}
                          className="w-16 rounded border border-border bg-background px-1 py-0.5 text-[10px] disabled:opacity-50"
                        />
                        ms
                      </label>
                    )}
                    <button type="button" onClick={() => updateFrame(i)} disabled={playing} title="Update this step to the current board" className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] hover:bg-muted disabled:opacity-50">Set</button>
                    <button type="button" onClick={() => insertFrameAfter(i)} disabled={playing} title="Insert the current board as a new step after this one" className="rounded-md border border-border bg-background px-1.5 py-1 text-[10px] hover:bg-muted disabled:opacity-50">
                      <Plus className="size-3" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => duplicateFrame(i)} disabled={playing} title="Duplicate step" className="rounded-md border border-border bg-background px-1.5 py-1 hover:bg-muted disabled:opacity-50">
                      <Copy className="size-3" aria-hidden="true" />
                    </button>
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

          {/* ── Player notes ──────────────────────────────────── */}
          {selectedTokenId && (() => {
            const tok = state.tokens.find((t) => t.id === selectedTokenId);
            if (!tok?.playerId) return null;
            const playerId = tok.playerId;
            const notes = state.playerNotes.filter((n) => n.playerId === playerId);
            return (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-primary" aria-hidden="true" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Notes for {tok.label}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Shown to {tok.label} in their own view of this play — real coaching feedback, not just a diagram.
                </p>
                {notes.length > 0 && (
                  <ul className="space-y-1">
                    {notes.map((n) => (
                      <li key={n.id} className="flex items-start gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                        <span className="flex-1">{n.body}</span>
                        <button type="button" onClick={() => deletePlayerNote(n.id)} title="Delete note" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && noteDraft.trim()) {
                        addPlayerNote(playerId, noteDraft);
                        setNoteDraft("");
                      }
                    }}
                    placeholder="e.g. Stay wide here to stretch their back line"
                    maxLength={280}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => { addPlayerNote(playerId, noteDraft); setNoteDraft(""); }}
                    disabled={!noteDraft.trim()}
                    className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Notes for a player who's been subbed off (or never placed)
              since their note was written — the panel above only shows
              while their token is selected, so without this a note becomes
              unreachable the moment they leave the pitch. Still shown
              correctly to that player in their own view either way; this
              is only about being able to see/delete it from the editor. */}
          {(() => {
            const onBoardPlayerIds = new Set(state.tokens.map((t) => t.playerId).filter((id): id is string => !!id));
            const offBoard = state.playerNotes.filter((n) => !onBoardPlayerIds.has(n.playerId));
            if (offBoard.length === 0) return null;
            return (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Notes for players not on the pitch
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Bring a player back on to add another note for them.
                </p>
                <ul className="space-y-1">
                  {offBoard.map((n) => {
                    const player = roster.find((p) => p.id === n.playerId);
                    return (
                      <li key={n.id} className="flex items-start gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                        <span className="flex-1">
                          <span className="font-semibold">{player ? shortLabel(player.full_name) : "A player"}: </span>
                          {n.body}
                        </span>
                        <button type="button" onClick={() => deletePlayerNote(n.id)} title="Delete note" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-3" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          <div>
            <div className="mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Bench {bench.length > 0 && `(${bench.length})`}
              </p>
              {selectedTokenId ? (
                <p className="mt-1 rounded bg-primary/10 px-2 py-1 text-[11px] text-primary">
                  {state.tokens.find((t) => t.id === selectedTokenId)?.label} selected — tap a
                  bench player to bring them on.
                  <button
                    type="button"
                    onClick={() => setSelectedTokenId(null)}
                    className="ml-1 underline"
                  >
                    Cancel
                  </button>
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Tap a player on the pitch to substitute them.
                </p>
              )}
            </div>
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
                    onClick={() => (selectedTokenId ? substitute(p) : placePlayer(p))}
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
