"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MousePointer2, Eraser, Undo2, Redo2, RotateCcw, Users, Circle,
  Pencil, Download, Tag, Grid3x3,
  Play, Square, Plus, Trash2,
  Target, MessageSquare, Type, Ruler,
  FlipHorizontal2, Maximize2, Minimize2, Hexagon, Video, Magnet, Timer, ListChecks, Crosshair, Share2, Map as MapIcon, AlignVerticalSpaceAround, Hash,
} from "lucide-react";
import { FORMATIONS, FORMATION_SIZES, type Formation } from "@/lib/formations";
import { readOpponent } from "@/lib/board-analysis";
import { PITCH_THEME_LIST } from "@/lib/pitch-themes";
import { passingLanes, spaceControl, offsideLines, zoneCounts } from "@/lib/board-overlays";
import { shiftToBall, reachTimes, pressingPlan, playerJobs } from "@/lib/board-coaching";
import { counterExploits, counterRunShapes, type OpponentCounter } from "@/lib/opponent-counter";
import { drawBoard, pickRecorderMime } from "@/lib/board-render";
import { framesFromShapes } from "@/lib/play-motion";
import {
  BOARD_W, BOARD_H, polyPath, interpolateFrames, totalDurationMs, zonePolygon, simplifyPath, type ZoneShape,
  getPitch, PITCHES, toBoardSpace, EQUIPMENT_SPECS, RECORDABLE_SHAPE_KINDS,
  GROUP_COLOR, groupOf, shortLabel, uid, assignToSlots, compress,
  DRAW_COLORS, SHAPE_STROKE, distanceMetres, teamShape, mirrorPoint, type Pitch,
  type EquipmentKind, type Point, type BoardObject, type BoardPlayer, type BoardTeam,
  type Token, type Shape, type Frame as ModelFrame,
} from "@/lib/board-model";
import { PitchLayer } from "@/components/tactics/pitch-layer";
import { TokenDefs, TokenGlyph } from "@/components/tactics/token-glyph";
import { ShapeDefs, ShapeGlyph } from "@/components/tactics/shape-glyph";
import {
  RunIcon, PassIcon, DribbleIcon, ShotIcon, PressIcon, StraightIcon, CurveIcon, CurveRightIcon,
  ZoneRectIcon, ZoneEllipseIcon, LassoIcon, SolidFillIcon, HatchIcon, ThinLineIcon, NormalLineIcon, BoldLineIcon,
} from "@/components/tactics/tool-icons";
import { EquipmentLayer } from "@/components/tactics/equipment-layer";
import { SavedPlaysPanel } from "@/components/tactics/saved-plays-panel";
import { AnimationPanel } from "@/components/tactics/animation-panel";
import { DraftRecoveryBanner } from "@/components/tactics/draft-recovery-banner";
import { ExploitLayer, ExploitLegend } from "@/components/tactics/exploit-layer";
import { PassingLaneLayer, SpaceControlLayer, LinesLayer, ZoneCountLayer, ReachTimeLayer } from "@/components/tactics/analysis-layers";
import { PlayerJobsList } from "@/components/tactics/player-jobs";
import { getOpponentScouting, type OpponentScouting } from "@/app/actions/tactic-plays";
import { useBoardStore, type BoardState } from "@/store/boardStore";
import { useBoardSetupStore } from "@/store/boardSetupStore";
import { useSavedPlaysStore } from "@/store/savedPlaysStore";
import { useBoardPlaybackStore } from "@/store/boardPlaybackStore";
import { useBoardInsightsStore, type AnalysisLayer } from "@/store/boardInsightsStore";

// ── Types ────────────────────────────────────────────────────────
// Token, Shape, ShapeKind and the Frame shape all come from board-model.ts
// now — the one place they're defined, shared with the read-only viewer and
// the canvas recorder. This board's own drawing tools produce
// run/pass/dribble/free/spotlight; zone/text exist in the shared ShapeKind
// for the film board's tools (components/tactics/film-board.tsx), not this
// one — RECORDABLE_SHAPE_KINDS is what actually gates what the canvas
// recorder here can draw, not this board's own tool set.
//
// BoardPlayer/BoardTeam also live in board-model.ts now — re-exported here
// so board/page.tsx's existing `import { TacticalBoard, type BoardTeam }
// from "@/components/tactics/tactical-board"` keeps working unchanged.
export type { BoardPlayer, BoardTeam };
// BoardState (tokens/shapes/objects/playerNotes) and the `state`/`draft`
// pair now live in store/boardStore.ts — the first slice of this
// component's state pulled into zustand, see docs/BACKLOG.md 3.3.
type Mode =
  | "move" | "run" | "pass" | "dribble" | "shot" | "press" | "free" | "zone" | "text"
  | "spotlight" | "measure" | "erase";
/** The tools that draw a Shape by dragging from one point to another. */
const DRAG_DRAW_MODES = new Set<Mode>(["run", "pass", "dribble", "shot", "press", "free", "zone"]);
/** Any icon the toolbar can show: lucide-react or tools-icons.tsx. */
type ToolIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
/** The movement tools — the ones the bend control applies to. */
const ARROW_MODES = new Set<Mode>(["run", "pass", "dribble", "shot", "press"]);
/** Line weights offered in the toolbar (board units). Picked by id rather
 *  than compared as floats; "normal" stores nothing, so a line drawn at the
 *  default weight saves exactly as it did before weights existed. */
const LINE_WEIGHTS = [
  { id: "thin", value: 0.8, label: "Thin" },
  { id: "normal", value: undefined, label: "Normal" },
  { id: "bold", value: 1.8, label: "Bold" },
] as const;
type LineWeightId = (typeof LINE_WEIGHTS)[number]["id"];
const WEIGHT_ICONS: Record<LineWeightId, ToolIcon> = { thin: ThinLineIcon, normal: NormalLineIcon, bold: BoldLineIcon };
/** How far a bent arrow bows, as a fraction of its length. */
const BEND = 0.22;

/** localStorage key prefix for the per-team unsaved-board draft. */
const DRAFT_KEY_PREFIX = "growfit.tactics.draft.";

/** An unsaved board, kept in localStorage so closing the tab doesn't lose it.
 * Exported for draft-recovery-banner.tsx's own prop typing. */
export interface BoardDraft {
  state: BoardState;
  frames: Frame[];
  pitchId: string;
  pitchThemeId?: string;
  homeFormationId?: string;
  awayFormationId?: string;
  playName?: string;
  savedAt: number;
}

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

/**
 * Each side's outfield shape: a translucent hull round the outfield
 * players, lines joining our back line / midfield / front line, and a
 * width × depth chip. Drawn from whatever tokens are showing, so it
 * stretches and squeezes live as the play animates.
 */
function TeamShapeLayer({ tokens, pitch }: { tokens: Token[]; pitch: Pitch }) {
  const sides = [
    { side: "player" as const, color: "#38bdf8", label: "Us" },
    { side: "opponent" as const, color: "#f87171", label: "Them" },
  ];
  const shapes = sides
    .map((s) => ({ ...s, shape: teamShape(tokens, s.side, pitch) }))
    .filter((s): s is typeof s & { shape: NonNullable<typeof s.shape> } => s.shape !== null);
  if (shapes.length === 0) return null;
  return (
    <g pointerEvents="none">
      {shapes.map(({ side, color, shape }) => (
        <g key={side}>
          {shape.hull.length >= 3 && (
            <path
              d={`${polyPath(shape.hull)} Z`}
              fill={color}
              fillOpacity={0.12}
              stroke={color}
              strokeOpacity={0.7}
              strokeWidth={0.5}
              strokeDasharray="1.8 1.2"
              strokeLinejoin="round"
            />
          )}
          {shape.units.map((u, i) => (
            <path key={i} d={polyPath(u)} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.45} />
          ))}
        </g>
      ))}
      {/* Readout chips, top-left, one per side. */}
      {shapes.map(({ side, color, label, shape }, i) => {
        const text = `${label} · ${Math.round(shape.widthM)}m wide · ${Math.round(shape.depthM)}m deep`;
        const w = text.length * 1.28 + 4;
        return (
          <g key={`chip-${side}`} transform={`translate(3.5 ${4 + i * 5})`}>
            <rect width={w} height={4} rx={2} fill="rgba(15,23,42,0.8)" />
            <circle cx={2.2} cy={2} r={0.9} fill={color} />
            <text x={3.8} y={2.95} fontSize={2.4} fontWeight={600} fill="#ffffff">{text}</text>
          </g>
        );
      })}
    </g>
  );
}

/** The measure tool's ruler: a dashed line with end ticks and a distance
 * label in metres at its midpoint. */
function MeasureLayer({ a, b, pitch }: { a: Point; b: Point; pitch: Pitch }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 0.5) return null;
  const m = distanceMetres(a, b, pitch);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  // Perpendicular unit vector for the end ticks.
  const px = -(b.y - a.y) / len, py = (b.x - a.x) / len;
  const tick = (p: Point) => (
    <line x1={p.x - px * 1.4} y1={p.y - py * 1.4} x2={p.x + px * 1.4} y2={p.y + py * 1.4} />
  );
  const label = m < 10 ? `${m.toFixed(1)} m` : `${Math.round(m)} m`;
  const w = label.length * 1.6 + 3;
  return (
    <g pointerEvents="none">
      <g stroke="#ffffff" strokeWidth={0.5} strokeLinecap="round">
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeDasharray="1.4 1" />
        {tick(a)}
        {tick(b)}
      </g>
      <g transform={`translate(${mx} ${my - 3.5})`}>
        <rect x={-w / 2} y={-2.4} width={w} height={3.8} rx={1.9} fill="#0f172a" stroke="#ffffff" strokeWidth={0.3} />
        <text y={0.5} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="#ffffff">{label}</text>
      </g>
    </g>
  );
}

export function TacticalBoard({ teams }: { teams: BoardTeam[] }) {
  const [mode, setMode] = useState<Mode>("move");
  const [showNames, setShowNames] = useState(true);
  const [overlay, setOverlay] = useState<Overlay>("none");
  /** Colour for the next drawn line/zone/label — null keeps each kind's
   *  own default (yellow runs, sky dribbles, …). */
  const [drawColor, setDrawColor] = useState<string | null>(null);
  /** Line weight for the next drawn shape (board units). */
  const [lineWeight, setLineWeight] = useState<LineWeightId>("normal");
  /** Bend for the next movement arrow: 0 straight, ±BEND left/right. */
  const [bend, setBend] = useState<number>(0);
  /** What the zone tool draws, and how it's filled. */
  const [zoneShape, setZoneShape] = useState<ZoneShape>("rect");
  const [zoneFill, setZoneFill] = useState<"solid" | "hatch">("solid");
  /** Team-shape overlay: each side's outfield hull, unit lines, and a
   *  width/depth readout — follows the players through playback. */
  const [showShape, setShowShape] = useState(false);
  /** The measure tool's current ruler. Deliberately not part of the board
   *  state: it's a question the coach is asking, not something to save. */
  const [measure, setMeasure] = useState<{ a: Point; b: Point } | null>(null);
  const measuring = useRef(false);
  const textPending = useRef<Point | null>(null);
  /** Where a new text label is being typed, in board units. */
  const [textAt, setTextAt] = useState<Point | null>(null);
  const [textValue, setTextValue] = useState("");
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Broadcast-camera tilt for presenting. View-only: pointer maths assumes
   *  a flat board, and a 3D-tilted one would put every tap in the wrong place. */
  const [tilted, setTilted] = useState(false);
  /** Auto-shift: which side slides with the ball, and where each of its
   *  players stood when it was switched on (the shape it shifts from). */
  const [autoShift, setAutoShift] = useState<{ side: "player" | "opponent"; anchors: Token[] } | null>(null);

  const { state, setState, draft, setDraft, reset: resetBoardState } = useBoardStore();
  const {
    teamId, setTeamId, homeFormationId, setHomeFormationId, awayFormationId, setAwayFormationId,
    pitchId, setPitchId: setPitchIdState, equipmentKind, setEquipmentKind, resetForTeam,
    pitchThemeId, setPitchThemeId,
  } = useBoardSetupStore();
  // Only playName/setCurrentPlayId are still read/written directly here
  // (draft autosave, video export filename, and the team-switch handler
  // below) — everything else the saved-plays panel needs, it now reads
  // from this same shared store itself; see saved-plays-panel.tsx.
  const { playName, setPlayName, setCurrentPlayId, fixtureId, resetPanel: resetSavedPlaysPanel } = useSavedPlaysStore();
  const {
    showExploits, setShowExploits, focusedExploitId, setFocusedExploitId,
    aiCounter, setAiCounter, layers, toggleLayer, reset: resetInsights,
  } = useBoardInsightsStore();
  // scrubMs/scrubbing/recording's own values are read by animation-panel.tsx
  // now (via the same store hook); only the setters are still called
  // directly here, by recordAnimation/scrubTo/endScrub.
  const {
    frames, setFrames, playing, setPlaying, setScrubMs,
    setScrubbing, setRecording, anim, setAnim,
    reset: resetPlayback,
  } = useBoardPlaybackStore();
  // Blank the board once on mount — plain useState gave this for free (a
  // fresh component instance always started blank); a zustand store is a
  // module-level singleton that would otherwise leak a previous visit's
  // tokens/team/formation/open-play/playback selection into a
  // freshly-mounted board.
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => { resetBoardState(); resetForTeam(teams[0]?.id ?? ""); resetSavedPlaysPanel(); resetPlayback(); resetInsights(); }, []);

  const rafRef = useRef<number | null>(null);

  // busy/notice stay local: used board-wide (animation capture, recording,
  // AI describe/analyse, substitutions, pitch switching), not just by the
  // saved-plays panel — see savedPlaysStore.ts's own note on why they were
  // deliberately left out of that slice.
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Tapping a player selects them; tapping a bench player then swaps the two.
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const stateRef = useRef(state);
  const pitchIdRef = useRef(pitchId);
  const framesRef = useRef(frames);
  // Synced in an effect rather than assigned during render (writing to a
  // ref mid-render is what `react-hooks/refs` flags — refs are for values
  // read outside rendering, in event handlers and other effects, which by
  // the time they run have always seen this effect flush first). One effect
  // for all three since they're read together everywhere that uses them.
  useEffect(() => {
    stateRef.current = state;
    pitchIdRef.current = pitchId;
    framesRef.current = frames;
  });
  const past = useRef<SnapshotEntry[]>([]);
  const future = useRef<SnapshotEntry[]>([]);
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

  /** The opponent's lines and the spaces they leave, read live off whatever
   *  is showing — so it follows drags and playback. See board-analysis.ts. */
  const reading = useMemo(() => readOpponent(view.tokens, pitch), [view.tokens, pitch]);
  const aiExploits = useMemo(() => (aiCounter ? counterExploits(aiCounter) : []), [aiCounter]);

  // Phase 2 analysis overlays — each computed only while switched on, and
  // only on a match pitch (a training grid has no goals to attack).
  const analysisOn = pitch.supportsFormations;
  const lanes = useMemo(() => (analysisOn && layers.lanes ? passingLanes(view.tokens, pitch) : null), [analysisOn, layers.lanes, view.tokens, pitch]);
  const control = useMemo(() => (analysisOn && layers.space ? spaceControl(view.tokens, pitch) : undefined), [analysisOn, layers.space, view.tokens, pitch]);
  const lineReading = useMemo(() => (analysisOn && layers.lines ? offsideLines(view.tokens, pitch) : null), [analysisOn, layers.lines, view.tokens, pitch]);
  const counts = useMemo(() => (analysisOn && layers.numbers ? zoneCounts(view.tokens) : null), [analysisOn, layers.numbers, view.tokens]);
  const ageGroup = team?.age_group ?? "U15";
  const times = useMemo(
    () => (layers.times ? reachTimes(view.tokens, view.shapes, pitch, ageGroup) : null),
    [layers.times, view.tokens, view.shapes, pitch, ageGroup]
  );
  const jobs = useMemo(
    () => (layers.jobs ? playerJobs(state.tokens, state.shapes, pitch) : null),
    [layers.jobs, state.tokens, state.shapes, pitch]
  );

  /** What we know about the linked fixture's opponent — drives the
   *  "usually plays…" shortcut in the Opponent card. */
  const scoutingKey = teamId && fixtureId ? `${teamId}:${fixtureId}` : "";
  const [scouted, setScouted] = useState<{ key: string; data: OpponentScouting | null }>({ key: "", data: null });
  useEffect(() => {
    let live = true;
    if (scoutingKey) {
      void getOpponentScouting(teamId, fixtureId).then((res) => {
        if (live) setScouted({ key: scoutingKey, data: res.scouting ?? null });
      });
    }
    return () => { live = false; };
  }, [scoutingKey, teamId, fixtureId]);
  // Keyed so switching fixture (or unlinking it) hides the old opponent at
  // once, rather than showing it until the next fetch lands.
  const scouting = scouted.key === scoutingKey ? scouted.data : null;

  // ── History ────────────────────────────────────────────────────
  // An undo step is the board state, the pitch id and the captured-steps
  // timeline *together*, so switching pitches (which clears the board — see
  // setPitch below) and every timeline edit (capture/reorder/duplicate/
  // insert/delete/duration — see captureFrame() etc. below, which all call
  // snapshot() first) are single undoable steps like any other edit, rather
  // than state sitting outside undo/redo entirely.
  //
  // That used to be six parallel refs — past/future × state/pitch/frames —
  // pushed and popped in lockstep by hand. captureSnapshot() already built
  // exactly the object below and commitSnapshot() immediately tore it back
  // into three arrays, so every code path had three chances to forget one
  // and desync undo silently. One array of whole entries removes the class
  // of bug rather than the instance.
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
    past.current.push(entry);
    if (past.current.length > 40) past.current.shift();
    future.current = [];
    // Every real edit commits a history entry, so this is the one place
    // that needs to know the board has diverged from what's saved.
    dirtyRef.current = true;
  }
  function snapshot() {
    commitSnapshot(captureSnapshot());
  }
  /** Applies a whole entry and returns the one it replaced, so undo and redo
   * are the same move in opposite directions. */
  function applyEntry(entry: SnapshotEntry): SnapshotEntry {
    const current = captureSnapshot();
    setState(entry.state);
    setPitchIdState(entry.pitch);
    setFrames(entry.frames);
    forceRender((n) => n + 1);
    return current;
  }
  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(applyEntry(prev));
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(applyEntry(next));
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

  /** Delete key: take the selected token off the pitch. Returns whether
   *  anything was removed, so the key handler only swallows Backspace
   *  when it actually did something. */
  function removeSelected(): boolean {
    if (!selectedTokenId) return false;
    snapshot();
    setState((st) => ({ ...st, tokens: st.tokens.filter((t) => t.id !== selectedTokenId) }));
    setSelectedTokenId(null);
    return true;
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────
  // There were none at all before this, on a drawing tool used at a desk.
  // The comment on setPitch() even described Undo as the "Ctrl/Cmd+Z
  // equivalent" — Ctrl+Z was bound to nothing; the only way back was the
  // toolbar button.
  //
  // Every handler is read through a ref so this effect binds once rather
  // than re-subscribing on each state change, and the shortcuts stay off
  // while the coach is typing into a play name, a note or a duration.
  const shortcutsRef = useRef({ undo, redo, playAnimation, stopPlayback, setMode, playing });
  // Synced in an effect rather than assigned during render: writing a ref
  // mid-render is what `react-hooks/refs` flags, and the handlers only ever
  // need to be current by the time a key is actually pressed.
  // No dep array on purpose — it re-syncs every render, which is the point.
  // exhaustive-deps sees `setMode` in the object and assumes it is being
  // called; it is only being stored for the keydown handler to call later.
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => {
    shortcutsRef.current = { undo, redo, playAnimation, stopPlayback, setMode, playing };
  });

  useEffect(() => {
    const TOOL_KEYS: Record<string, Mode> = {
      v: "move", r: "run", p: "pass", d: "dribble", k: "shot", x: "press",
      f: "free", z: "zone", t: "text", s: "spotlight",
      m: "measure", e: "erase",
    };

    function onKeyDown(ev: KeyboardEvent) {
      // Never steal a keystroke aimed at a field. `isContentEditable`
      // covers the rich-text cases a plain tagName check misses.
      const target = ev.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      const h = shortcutsRef.current;
      const mod = ev.metaKey || ev.ctrlKey;

      if (mod && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        // Cmd/Ctrl+Shift+Z is redo on both platforms; Ctrl+Y as well, for
        // the Windows convention.
        if (ev.shiftKey) h.redo(); else h.undo();
        return;
      }
      if (mod && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        h.redo();
        return;
      }
      if (mod) return; // leave every other browser shortcut alone

      if (ev.key === " ") {
        ev.preventDefault();
        if (h.playing) h.stopPlayback(); else h.playAnimation();
        return;
      }
      if (ev.key === "Escape") {
        setSelectedTokenId(null);
        setMeasure(null);
        h.setMode("move");
        return;
      }

      const tool = TOOL_KEYS[ev.key.toLowerCase()];
      if (tool) {
        ev.preventDefault();
        h.setMode(tool);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Draft autosave ─────────────────────────────────────────────
  // A coach could build a twelve-frame animation and lose the lot by
  // tapping back, or by the phone backgrounding the tab and the browser
  // reclaiming it. Nothing was persisted until an explicit Save, and there
  // was no navigation guard.
  //
  // The draft is offered, never applied automatically: silently restoring
  // yesterday's board over a coach who deliberately opened a blank one is
  // its own kind of data loss. Scoped per team, because switching teams is
  // a deliberate context change.
  //
  // Every localStorage access is wrapped — it throws outright in some
  // privacy modes, and a board that won't open is a far worse failure than
  // one that doesn't remember a draft.
  const draftKey = teamId ? `${DRAFT_KEY_PREFIX}${teamId}` : null;
  const [draftOffer, setDraftOffer] = useState<BoardDraft | null>(null);
  /** False until the coach has actually touched this board, so simply
   *  opening the page can't overwrite a real draft with an empty one. */
  const dirtyRef = useRef(false);

  const clearDraft = () => {
    dirtyRef.current = false;
    if (!draftKey) return;
    try { window.localStorage.removeItem(draftKey); } catch { /* unavailable */ }
  };

  // Offer whatever was left behind, once per team.
  useEffect(() => {
    dirtyRef.current = false;
    let cancelled = false;

    function read(): BoardDraft | null {
      if (!draftKey) return null;
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (!raw) return null;
        const draft = JSON.parse(raw) as BoardDraft;
        // An empty board is not worth offering to restore.
        if (!draft?.state?.tokens?.length && !draft?.state?.shapes?.length) return null;
        return draft;
      } catch {
        // Corrupt or unreadable — drop it rather than blocking the board.
        try { window.localStorage.removeItem(draftKey); } catch { /* unavailable */ }
        return null;
      }
    }

    const draft = read();
    // Deferred out of the effect body on purpose: setting state
    // synchronously here would cascade a second render before paint on
    // every mount and every team switch, which is what
    // `react-hooks/set-state-in-effect` is about. The banner has no reason
    // to appear a frame earlier than this.
    void Promise.resolve().then(() => { if (!cancelled) setDraftOffer(draft); });
    return () => { cancelled = true; };
  }, [draftKey]);

  // Persist, debounced, once the board has actually been edited.
  useEffect(() => {
    if (!draftKey || !dirtyRef.current) return;
    const timer = setTimeout(() => {
      try {
        const draft: BoardDraft = {
          state, frames, pitchId, pitchThemeId, homeFormationId, awayFormationId,
          playName, savedAt: Date.now(),
        };
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch { /* quota or unavailable — the board still works */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [draftKey, state, frames, pitchId, pitchThemeId, homeFormationId, awayFormationId, playName]);

  // Warn before leaving with unsaved work. The browser shows its own
  // wording; the string is only required to trigger the prompt at all.
  useEffect(() => {
    function onBeforeUnload(ev: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      ev.preventDefault();
      ev.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Delete/Backspace takes the selected player off the pitch. Its own
  // listener rather than a branch of the shortcuts effect above: that
  // effect runs before dirtyRef exists, and removeSelected() reaches
  // dirtyRef through snapshot().
  const removeSelectedRef = useRef(removeSelected);
  useEffect(() => { removeSelectedRef.current = removeSelected; });
  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      const target = ev.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (removeSelectedRef.current()) ev.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function restoreDraft(draft: BoardDraft) {
    snapshot();
    setState(draft.state);
    setFrames(draft.frames ?? []);
    setPitchIdState(draft.pitchId ?? "full");
    setPitchThemeId(draft.pitchThemeId ?? "classic");
    if (draft.homeFormationId) setHomeFormationId(draft.homeFormationId);
    if (draft.awayFormationId) setAwayFormationId(draft.awayFormationId);
    if (draft.playName) setPlayName(draft.playName);
    setDraftOffer(null);
    setNotice("Restored your unsaved board. Save it to keep it for good.");
  }

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

  // ── Coordinates ────────────────────────────────────────────────
  // Clamped to the *current* pitch's dimensions, not the fixed 100×150 —
  // the SVG's viewBox below tracks the same pitch, so this always matches
  // what's actually visible.
  function toBoard(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return toBoardSpace(rect, clientX, clientY, pitch.w, pitch.h);
  }

  // ── Setup actions ──────────────────────────────────────────────
  /** Our XI in formation `f`, real players assigned to the slots that match
   *  how they play. Squeezed into our own half when the opponent is up too,
   *  so the two shapes face each other instead of interleaving. */
  function homeTokens(f: Formation, vsOpponent: boolean): Token[] {
    const assigned = assignToSlots(f, roster);
    return f.slots.map((slot, i) => {
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
    });
  }
  function setUpHome() {
    const f = FORMATIONS.find((x) => x.id === homeFormationId)!;
    snapshot();
    setState((st) => ({
      ...st,
      // Only use the full pitch when we're the only team on the board.
      tokens: [...st.tokens.filter((t) => t.kind !== "player"), ...homeTokens(f, st.tokens.some((t) => t.kind === "opponent"))],
    }));
  }
  function setUpAway(formationId: string = awayFormationId) {
    const f = FORMATIONS.find((x) => x.id === formationId)!;
    const home = FORMATIONS.find((x) => x.id === homeFormationId)!;
    snapshot();
    setState((st) => {
      const hadHome = st.tokens.some((t) => t.kind === "player");
      return {
        ...st,
        tokens: [
          ...st.tokens.filter((t) => t.kind !== "opponent" && t.kind !== "player"),
          // With both teams up, each side is compressed into its own half so
          // the shapes face each other instead of interleaving through midfield.
          ...(hadHome ? homeTokens(home, true) : []),
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

  /**
   * The AI counter, made real: switch our side to the suggested shape (same
   * roster assignment as "Set up my XI") and draw its suggested runs as
   * ordinary arrows — editable, saveable, and animated by Play because each
   * run starts on the player it belongs to. One undo step for the lot.
   */
  function applyCounter(counter: OpponentCounter) {
    const f = counter.counterFormationId ? FORMATIONS.find((x) => x.id === counter.counterFormationId) : undefined;
    const current = stateRef.current;
    const reshape = !!f && pitch.supportsFormations;
    const tokens = reshape
      ? [...current.tokens.filter((t) => t.kind !== "player"), ...homeTokens(f!, current.tokens.some((t) => t.kind === "opponent"))]
      : current.tokens;
    const runs = counterRunShapes(counter.counterRuns, tokens);
    snapshot();
    setState({ ...current, tokens, shapes: [...current.shapes, ...runs] });
    if (reshape) setHomeFormationId(f!.id);
    setNotice(
      `${reshape ? `Switched to ${f!.label}` : "Kept your shape"} and drew ${runs.length} suggested move${runs.length === 1 ? "" : "s"} — press Play to watch, or drag them to adjust. Undo reverts it.`
    );
  }

  /** Draw a press on the opponent with the ball — see pressingPlan(). */
  function buildPress() {
    const plan = pressingPlan(stateRef.current.tokens);
    if (!plan.carrierId) {
      setNotice("Put the ball at an opponent's feet first — the press is built around whoever has it.");
      return;
    }
    snapshot();
    setState((st) => ({ ...st, shapes: [...st.shapes, ...plan.shapes] }));
    const n = (r: string) => plan.roles.filter((x) => x.role === r).length;
    setNotice(`Press drawn: 1 presser, ${n("cover")} cutting the passing lanes, ${n("mark")} marking goal-side. Press Play to watch it, drag any line to adjust.`);
  }
  function toggleAutoShift(side: "player" | "opponent" | null) {
    if (!side || autoShift?.side === side) {
      setAutoShift(null);
      return;
    }
    const anchors = stateRef.current.tokens.filter((t) => t.kind === side);
    if (anchors.length < 3 || !stateRef.current.tokens.some((t) => t.kind === "ball")) {
      setNotice(`Auto-shift needs the ${side === "opponent" ? "opponent" : "team"} set up and a ball on the pitch.`);
      return;
    }
    setAutoShift({ side, anchors });
    setNotice(`Auto-shift on — drag the ball and ${side === "opponent" ? "they" : "we"} slide and squeeze as a unit.`);
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
    setMeasure(null);
  }
  /**
   * Flip everything left-to-right — a move built down the left wing
   * becomes the same move down the right. The captured steps flip too, so
   * an animated play still plays, just on the other flank. One undo step.
   */
  function mirrorBoard() {
    stopPlayback();
    snapshot();
    const w = pitch.w;
    const flipShape = (sh: Shape): Shape => ({ ...sh, pts: sh.pts.map((p) => mirrorPoint(p, w)) });
    setState((st) => ({
      ...st,
      tokens: st.tokens.map((t) => mirrorPoint(t, w)),
      shapes: st.shapes.map(flipShape),
      objects: st.objects.map((o) => ({ ...mirrorPoint(o, w), rotation: o.rotation ? -o.rotation : o.rotation })),
    }));
    setFrames((fs) => fs.map((f) => ({ ...f, tokens: f.tokens.map((t) => mirrorPoint(t, w)), shapes: f.shapes.map(flipShape) })));
    setMeasure(null);
    setNotice("Mirrored the board left-to-right.");
  }
  function commitText() {
    const at = textAt;
    const body = textValue.trim();
    setTextAt(null);
    setTextValue("");
    if (!at || !body) return;
    snapshot();
    setState((st) => ({
      ...st,
      shapes: [...st.shapes, { id: uid("s"), kind: "text", pts: [at], text: body, color: drawColor ?? undefined }],
    }));
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await boardWrapRef.current?.requestFullscreen();
    } catch {
      setNotice("Full screen isn't available in this browser.");
    }
  }
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === boardWrapRef.current && !!boardWrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
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
    if (mode === "text") {
      // A tap elsewhere while typing just finishes the label in progress.
      if (textAt) { commitText(); return; }
      // Opened on pointer-up, not here: the browser moves focus on the
      // mousedown that follows this event, which would blur (and so close)
      // an input autofocused this early.
      textPending.current = { x, y };
      return;
    }
    if (mode === "measure") {
      measuring.current = true;
      setMeasure({ a: { x, y }, b: { x, y } });
      svgRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    if (!DRAG_DRAW_MODES.has(mode)) return;
    drawing.current = true;
    setDraft({
      id: "draft",
      kind: mode as Shape["kind"],
      pts: [{ x, y }, { x, y }],
      color: drawColor ?? undefined,
      // Only stored when it differs from the default, so an ordinary line
      // saves exactly as it did before these options existed.
      width: LINE_WEIGHTS.find((lw) => lw.id === lineWeight)?.value,
      curve: ARROW_MODES.has(mode) && bend ? bend : undefined,
      fill: mode === "zone" && zoneFill === "hatch" ? "hatch" : undefined,
    });
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
      setState((st) => {
        const next = { x: Math.max(2, Math.min(pitch.w - 2, x + d.dx)), y: Math.max(2, Math.min(pitch.h - 2, y + d.dy)) };
        const moved = st.tokens.find((t) => t.id === d.id);
        // Auto-shift: moving the ball re-places the chosen side as a unit,
        // from its resting shape — so the same ball spot always gives the
        // same shape, and dragging the ball back restores it.
        const shifted = moved?.kind === "ball" && autoShift ? shiftToBall(autoShift.anchors, next, autoShift.side) : null;
        return {
          ...st,
          tokens: st.tokens.map((t) => {
            if (t.id === d.id) return { ...t, ...next };
            const p = shifted?.get(t.id);
            return p ? { ...t, ...p } : t;
          }),
        };
      });
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
    } else if (measuring.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      setMeasure((m) => (m ? { ...m, b: { x, y } } : m));
    } else if (drawing.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      setDraft((d) => {
        if (!d) return d;
        if (d.kind === "free" || (d.kind === "zone" && zoneShape === "lasso")) return { ...d, pts: [...d.pts, { x, y }] };
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
    measuring.current = false;
    if (textPending.current) {
      setTextAt(textPending.current);
      textPending.current = null;
    }
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
      } else if (draft.kind === "zone") {
        // Stored as a 4-corner polygon, the shape every zone renderer
        // (this board, play-viewer.tsx, the film board) already reads.
        // Ellipses and lassos are polygons too, so nothing downstream
        // needs to know which tool drew them.
        const pts = zoneShape === "lasso" ? simplifyPath(draft.pts) : zonePolygon(a, b, zoneShape);
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        if (pts.length >= 3 && Math.max(...xs) - Math.min(...xs) > 2 && Math.max(...ys) - Math.min(...ys) > 2) {
          snapshot();
          setState((st) => ({ ...st, shapes: [...st.shapes, { ...draft, id: uid("s"), pts }] }));
        }
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
  /** Key that selects each tool — mirrored by the keydown handler above and
   *  shown in the tooltip, since an unadvertised shortcut helps nobody. */
  const TOOL_SHORTCUT: Record<Mode, string> = {
    move: "V", run: "R", pass: "P", dribble: "D", shot: "K", press: "X",
    free: "F", zone: "Z", text: "T", spotlight: "S",
    measure: "M", erase: "E",
  };
  const toolBtn = (m: Mode, Icon: ToolIcon, label: string) => (
    <button
      key={m}
      type="button"
      onClick={() => setMode(m)}
      title={`${label} (${TOOL_SHORTCUT[m]})`}
      aria-label={`${label} tool`}
      aria-pressed={mode === m}
      className={`inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        mode === m ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background border-border hover:bg-muted"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
  /** A small labelled cluster of tools — "Movement", "Areas", … */
  const toolGroup = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1">
      <span className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
  /** One option in a segmented style control (bend, weight, zone shape, fill). */
  const styleOpt = (active: boolean, onClick: () => void, Icon: ToolIcon, label: string, iconOnly = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={`inline-flex h-8 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {!iconOnly && label}
    </button>
  );
  const segmented = (label: string, children: React.ReactNode) => (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">{children}</div>
    </div>
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
    // A zone draft is still [start, current] (or the lasso's trail) —
    // previewed as the polygon it becomes on release.
    const shown =
      isDraft && sh.kind === "zone" && zoneShape !== "lasso" && sh.pts.length >= 2
        ? { ...sh, pts: zonePolygon(sh.pts[0], sh.pts[sh.pts.length - 1], zoneShape) }
        : sh;
    return (
      <ShapeGlyph
        key={sh.id}
        sh={shown}
        prefix="tb"
        tokens={view.tokens}
        isDraft={isDraft}
        cursor={mode === "erase" ? "pointer" : undefined}
        onPointerDown={isDraft ? undefined : (e) => onShapeDown(e, sh.id)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Unsaved draft from a previous visit. Offered rather than applied:
          silently restoring over a coach who opened a blank board on
          purpose would be its own kind of data loss. */}
      {draftOffer && (
        <DraftRecoveryBanner
          draft={draftOffer}
          onRestore={() => restoreDraft(draftOffer)}
          onDiscard={() => { setDraftOffer(null); clearDraft(); }}
        />
      )}

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
            onClick={() => setUpAway()}
            disabled={!pitch.supportsFormations}
            title={pitch.supportsFormations ? undefined : "Formations need the full pitch — switch pitch below"}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Circle className="size-3.5" aria-hidden="true" />
            Set up opponent XI
          </button>
          {scouting && scouting.formations.length > 0 && pitch.supportsFormations && (
            <button
              type="button"
              onClick={() => { setAwayFormationId(scouting.formations[0].formationId); setUpAway(scouting.formations[0].formationId); }}
              title="Set them up in the shape you've used for them before"
              className="w-full rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 py-1.5 text-left text-xs hover:bg-primary/10"
            >
              <span className="font-semibold">{scouting.opponent}</span> usually set up as{" "}
              <span className="font-semibold">{scouting.formations[0].label}</span>
              <span className="text-muted-foreground"> ({scouting.formations[0].count} play{scouting.formations[0].count === 1 ? "" : "s"}) — use it</span>
            </button>
          )}
          {scouting && scouting.formations.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No saved shape for {scouting.opponent} yet — set them up and save a play to remember it.</p>
          )}
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
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Pitch look">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Look</span>
          {PITCH_THEME_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={pitchThemeId === t.id}
              onClick={() => setPitchThemeId(t.id)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${
                pitchThemeId === t.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:bg-muted"
              }`}
            >
              {/* A tiny swatch of the theme itself: its stripes and line colour. */}
              <span
                aria-hidden="true"
                className="inline-block h-5 w-4 rounded-sm border"
                style={{
                  backgroundImage: `repeating-linear-gradient(to bottom, ${t.stripes[0]} 0 3px, ${t.stripes[1]} 3px 6px)`,
                  borderColor: t.line,
                }}
              />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tools */}
      <div className="rounded-xl border border-border bg-card p-2 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            {toolGroup("Select", toolBtn("move", MousePointer2, "Move"))}
            {toolGroup("Movement", <>
              {toolBtn("run", RunIcon, "Run")}
              {toolBtn("pass", PassIcon, "Pass")}
              {toolBtn("dribble", DribbleIcon, "Dribble")}
              {toolBtn("shot", ShotIcon, "Shot")}
              {toolBtn("press", PressIcon, "Press")}
            </>)}
            {toolGroup("Areas", <>
              {toolBtn("zone", zoneShape === "ellipse" ? ZoneEllipseIcon : zoneShape === "lasso" ? LassoIcon : ZoneRectIcon, "Zone")}
              {toolBtn("free", Pencil, "Draw")}
            </>)}
            {toolGroup("Annotate", <>
              {toolBtn("text", Type, "Label")}
              {toolBtn("spotlight", Target, "Spotlight")}
              {toolBtn("measure", Ruler, "Measure")}
              {toolBtn("erase", Eraser, "Erase")}
            </>)}
          </div>
        </div>
        {/* Style for the next thing drawn — only the controls that apply to
            the current tool, so the bar doesn't fill with dead options. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2">
          {ARROW_MODES.has(mode) && segmented("Path", <>
            {styleOpt(bend === 0, () => setBend(0), StraightIcon, "Straight")}
            {styleOpt(bend > 0, () => setBend(BEND), CurveIcon, "Bend left")}
            {styleOpt(bend < 0, () => setBend(-BEND), CurveRightIcon, "Bend right")}
          </>)}
          {mode === "zone" && segmented("Shape", <>
            {styleOpt(zoneShape === "rect", () => setZoneShape("rect"), ZoneRectIcon, "Box")}
            {styleOpt(zoneShape === "ellipse", () => setZoneShape("ellipse"), ZoneEllipseIcon, "Oval")}
            {styleOpt(zoneShape === "lasso", () => setZoneShape("lasso"), LassoIcon, "Lasso")}
          </>)}
          {mode === "zone" && segmented("Fill", <>
            {styleOpt(zoneFill === "solid", () => setZoneFill("solid"), SolidFillIcon, "Solid")}
            {styleOpt(zoneFill === "hatch", () => setZoneFill("hatch"), HatchIcon, "Hatched")}
          </>)}
          {DRAG_DRAW_MODES.has(mode) && segmented("Weight", <>
            {LINE_WEIGHTS.map((lw) =>
              styleOpt(lineWeight === lw.id, () => setLineWeight(lw.id), WEIGHT_ICONS[lw.id], lw.label, true)
            )}
          </>)}
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Line colour">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Colour</span>
          <button
            type="button"
            role="radio"
            aria-checked={drawColor === null}
            onClick={() => setDrawColor(null)}
            title="Default colours (yellow runs & passes, blue dribbles)"
            className={`h-7 rounded-full border px-2 text-[11px] font-medium ${
              drawColor === null ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"
            }`}
          >
            Auto
          </button>
          {DRAW_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={drawColor === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => setDrawColor(c.value)}
              className={`size-7 rounded-full border-2 transition-transform ${
                drawColor === c.value ? "scale-110 border-foreground ring-2 ring-primary/40" : "border-border hover:scale-105"
              }`}
              style={{ background: c.value }}
            />
          ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
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
        <button type="button" onClick={undo} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" className="inline-flex h-10 sm:h-9 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted"><Undo2 className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo" className="inline-flex h-10 sm:h-9 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted"><Redo2 className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={() => setShowNames((v) => !v)} title="Toggle names" className={`inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border px-2.5 text-xs ${showNames ? "bg-muted border-border" : "bg-background border-border"} hover:bg-muted`}>
          <Tag className="size-3.5" aria-hidden="true" /> Names
        </button>
        <button type="button" onClick={mirrorBoard} title="Flip the board left-to-right" className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">
          <FlipHorizontal2 className="size-3.5" aria-hidden="true" /> Mirror
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={clearDrawings} className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">Clear lines</button>
        <button type="button" onClick={clearAll} className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">
          <RotateCcw className="size-3.5" aria-hidden="true" /> Reset
        </button>
        <button type="button" onClick={exportPng} className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted">
          <Download className="size-3.5 text-primary" aria-hidden="true" /> PNG
        </button>
      </div>

      {/* Analyse: read the shapes on the pitch — everything here is a view
          over the board, never an edit to it. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2">
        <span className="mr-1 px-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Analyse</span>
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
        <button
          type="button"
          onClick={() => setShowShape((v) => !v)}
          aria-pressed={showShape}
          title="Show each side's shape, unit lines, width and depth"
          className={`inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border px-2.5 text-xs ${showShape ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
        >
          <Hexagon className="size-3.5" aria-hidden="true" /> Team shape
        </button>
        <button
          type="button"
          onClick={() => setShowExploits(!showExploits)}
          aria-pressed={showExploits}
          disabled={!pitch.supportsFormations}
          title="Read the opponent's shape and highlight where the space is"
          className={`inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border px-2.5 text-xs disabled:opacity-40 ${showExploits ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
        >
          <Crosshair className="size-3.5" aria-hidden="true" /> Find space
        </button>
        {([
          ["lanes", Share2, "Passing lanes", "Every pass open to the player on the ball — green open, amber risky, red cut out"],
          ["space", MapIcon, "Space control", "Who owns which grass: each patch goes to the nearest player"],
          ["lines", AlignVerticalSpaceAround, "Offside & lines", "Their offside line, anyone beyond it, and the gaps between each side's lines"],
          ["numbers", Hash, "Numbers", "Us v them in every zone"],
        ] as [AnalysisLayer, typeof Share2, string, string][]).map(([key, Icon, label, title]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            aria-pressed={layers[key]}
            disabled={!pitch.supportsFormations}
            title={title}
            className={`inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border px-2.5 text-xs disabled:opacity-40 ${layers[key] ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
          >
            <Icon className="size-3.5" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {/* Coach: tools that do something to the board for you. */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2">
        <span className="mr-1 px-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coach</span>
        <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5" role="group" aria-label="Auto-shift">
          <span className="px-1.5 text-[11px] font-medium text-muted-foreground" title="Drag the ball and the chosen side slides and squeezes as a zonal unit">
            <Magnet className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />Auto-shift
          </span>
          {([["opponent", "Them"], ["player", "Us"]] as const).map(([side, label]) => (
            <button
              key={side}
              type="button"
              onClick={() => toggleAutoShift(side)}
              aria-pressed={autoShift?.side === side}
              disabled={!pitch.supportsFormations}
              className={`inline-flex h-8 items-center rounded px-2 text-[11px] font-medium disabled:opacity-40 ${
                autoShift?.side === side ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={buildPress}
          disabled={!pitch.supportsFormations}
          title="Put the ball at an opponent's feet: draws who presses, who cuts the passes and who marks"
          className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-40"
        >
          <PressIcon className="size-4" aria-hidden="true" /> Build press
        </button>
        {([
          ["times", Timer, "Run times", "How long each run takes at this age group, and whether the nearest opponent gets there first"],
          ["jobs", ListChecks, "Player jobs", "Each player's movements as plain instructions — the same list players see on a shared play"],
        ] as [AnalysisLayer, typeof Timer, string, string][]).map(([key, Icon, label, title]) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            aria-pressed={layers[key]}
            title={title}
            className={`inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border px-2.5 text-xs ${layers[key] ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
          >
            <Icon className="size-3.5" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        {/* Pitch.
            `max-w-md` (448px) used to apply at every breakpoint, so a coach
            on a laptop got a phone-width pitch with the rest of the `1fr`
            column empty — on the one screen in the app that is entirely
            about spatial detail.
            Lifting the cap outright would be wrong, though: the full pitch
            is 100×150, i.e. *portrait*, so an unbounded width on a wide
            column would make it taller than the viewport and unusable. What
            actually binds is height, not width. So from `lg` up the ceiling
            becomes the height the viewport can give, converted through this
            pitch's own aspect ratio — and floored at the old 28rem so this
            can never render smaller than it did before.
            For the full pitch that means a taller monitor gets a bigger
            board; for the half/third/grid pitches (which are landscape or
            square, aspect >= 1) it means the board finally uses the width
            the desktop layout already had spare. */}
        <div
          ref={boardWrapRef}
          className={
            isFullscreen
              ? "flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 p-4"
              : "mx-auto w-full max-w-md lg:max-w-(--pitch-max-w)"
          }
          style={{
            "--pitch-max-w": `max(28rem, calc((100dvh - 14rem) * ${pitch.w / pitch.h}))`,
          } as React.CSSProperties}
        >
          {/* Aspect ratio driven off the *current* pitch, not a hardcoded
              2:3 — a training grid or half/third pitch has a different
              shape, and the viewBox below always matches pitch.w/pitch.h.
              A mismatch here isn't just cosmetic letterboxing: toBoard()
              assumes the viewBox fills this box exactly, so a wrong ratio
              also means every click lands at the wrong coordinate. */}
          <div
            className={`relative w-full overflow-hidden rounded-xl border border-border shadow-lg shadow-black/20 ring-1 ring-black/5 ${tilted ? "bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950" : ""}`}
            style={{
              aspectRatio: `${pitch.w} / ${pitch.h}`,
              // Full screen: as big as the screen allows at this pitch's ratio,
              // leaving room for the playback bar underneath.
              ...(isFullscreen ? { width: `min(100%, calc((100dvh - 7rem) * ${pitch.w / pitch.h}))` } : {}),
            }}
          >
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit full screen" : "Full screen — for the team talk"}
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              className="absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md bg-black/45 text-white backdrop-blur-sm hover:bg-black/65"
            >
              {isFullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setTilted((v) => !v)}
              aria-pressed={tilted}
              title={tilted ? "Back to the flat board (to edit)" : "Broadcast view — tilt the pitch for presenting"}
              aria-label="Broadcast view"
              className={`absolute right-11 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md text-white backdrop-blur-sm ${tilted ? "bg-primary" : "bg-black/45 hover:bg-black/65"}`}
            >
              <Video className="size-4" aria-hidden="true" />
            </button>
            {tilted && (
              <span className="absolute left-2 top-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                Broadcast view · tap the camera to edit
              </span>
            )}
            {textAt && (
              <input
                autoFocus
                value={textValue}
                maxLength={40}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitText();
                  if (e.key === "Escape") { setTextAt(null); setTextValue(""); }
                }}
                onBlur={commitText}
                placeholder="Type a label…"
                aria-label="Label text"
                className="absolute z-10 w-36 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/60 bg-slate-900/85 px-2 py-1 text-xs text-white shadow-lg placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ left: `${(textAt.x / pitch.w) * 100}%`, top: `${(textAt.y / pitch.h) * 100}%` }}
              />
            )}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${pitch.w} ${pitch.h}`}
              className="h-full w-full touch-none select-none transition-transform duration-500 ease-out"
              style={tilted ? { transform: "perspective(900px) rotateX(40deg) scale(0.9)", transformOrigin: "50% 70%", pointerEvents: "none" } : undefined}
              onPointerDown={onSvgDown}
              onPointerMove={onSvgMove}
              onPointerUp={onSvgUp}
              onPointerLeave={onSvgUp}
            >
              <ShapeDefs prefix="tb" />
              <TokenDefs prefix="tb-tok" />

              <PitchLayer pitch={pitch} stripeId="tb-stripe" themeId={pitchThemeId} />

              {control !== undefined && <SpaceControlLayer control={control} h={pitch.h} />}

              {pitch.supportsFormations && <OverlayLayer overlay={overlay} />}

              {showShape && <TeamShapeLayer tokens={view.tokens} pitch={pitch} />}

              {showExploits && pitch.supportsFormations && (
                <ExploitLayer exploits={{ engine: reading.exploits, ai: aiExploits }} lines={reading.lines} focusedId={focusedExploitId} />
              )}
              {counts && <ZoneCountLayer counts={counts} />}
              {lanes && <PassingLaneLayer lanes={lanes.lanes} h={pitch.h} />}
              {lineReading && <LinesLayer lines={lineReading} tokens={view.tokens} w={pitch.w} h={pitch.h} />}

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
                  <TokenGlyph
                    tok={tok}
                    prefix="tb-tok"
                    showName={showNames}
                    selected={tok.id === selectedTokenId}
                  />
                </g>
              ))}

              {/* Above the tokens: a time label hidden under a player is no use. */}
              {times && <ReachTimeLayer times={times} />}
              {mode === "measure" && measure && <MeasureLayer a={measure.a} b={measure.b} pitch={pitch} />}
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
            {mode === "zone" && (zoneShape === "lasso"
              ? "Draw round an area to shade it — any shape you like."
              : `Drag ${zoneShape === "ellipse" ? "an oval" : "a box"} to shade an area — a pressing trap, a target zone, a space to exploit.`)}
            {mode === "shot" && "Drag to draw a shot at goal — Play sends the ball along it."}
            {mode === "press" && "Drag from a player toward who they press — the bar marks where they close down."}
            {mode === "text" && "Tap the pitch and type a label. Enter to place it, Esc to cancel."}
            {mode === "measure" && "Drag between two points to measure the distance in metres."}
            {mode === "spotlight" && "Tap a player to highlight them — it follows them through every frame. Tap again to remove."}
            {mode === "erase" && "Tap a player, a line, a zone or a label to remove it."}
            <span className="hidden lg:inline text-muted-foreground/70">
              {" "}· Keys: V move, R run, P pass, D dribble, K shot, X press, F freehand, Z zone, T label,
              S spotlight, M measure, E erase · Del removes the selected player · Space plays · Ctrl/Cmd+Z undoes
            </span>
          </p>

          {showExploits && pitch.supportsFormations && (
            <ExploitLegend
              engine={reading.exploits}
              ai={aiExploits}
              counter={aiCounter}
              hasOpponent={view.tokens.some((t) => t.kind === "opponent")}
              focusedId={focusedExploitId}
              onFocus={(id) => setFocusedExploitId(focusedExploitId === id ? null : id)}
              onApply={() => aiCounter && applyCounter(aiCounter)}
              onClearAi={() => setAiCounter(null)}
            />
          )}
          {jobs && <PlayerJobsList jobs={jobs} className="mt-3" />}
        </div>

        {/* Bench + legend */}
        <div className="space-y-4">
          <AnimationPanel
            captureFrame={captureFrame}
            stopPlayback={stopPlayback}
            playAnimation={playAnimation}
            recordAnimation={recordAnimation}
            snapshot={snapshot}
            scrubTo={scrubTo}
            endScrub={endScrub}
            gotoFrame={gotoFrame}
            setFrameDuration={setFrameDuration}
            updateFrame={updateFrame}
            insertFrameAfter={insertFrameAfter}
            duplicateFrame={duplicateFrame}
            deleteFrame={deleteFrame}
            moveFrame={moveFrame}
          />

          <SavedPlaysPanel
            ageGroup={team?.age_group ?? "U15"}
            busy={busy}
            setBusy={setBusy}
            notice={notice}
            setNotice={setNotice}
            snapshot={snapshot}
            clearDraft={clearDraft}
          />

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
                        {/* Same false-positive shape as onShapeDown above:
                            deletePlayerNote() reads a ref via snapshot(),
                            but only once this onClick actually fires. */}
                        {/* eslint-disable-next-line react-hooks/refs */}
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
                        // Same false-positive shape as onShapeDown above:
                        // addPlayerNote() reads a ref via snapshot(), only
                        // once this Enter keydown actually fires.
                        // eslint-disable-next-line react-hooks/refs
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
                {([
                  [RunIcon, SHAPE_STROKE.run, "Run"],
                  [PassIcon, SHAPE_STROKE.pass, "Pass"],
                  [DribbleIcon, SHAPE_STROKE.dribble, "Dribble"],
                  [ShotIcon, SHAPE_STROKE.shot, "Shot"],
                  [PressIcon, SHAPE_STROKE.press, "Press"],
                  [ZoneRectIcon, SHAPE_STROKE.zone, "Zone"],
                  [HatchIcon, SHAPE_STROKE.zone, "Hatched zone — no-go / press here"],
                ] as [ToolIcon, string, string][]).map(([Icon, color, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="inline-flex size-5 items-center justify-center rounded bg-emerald-800" style={{ color }}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
