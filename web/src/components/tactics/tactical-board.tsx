"use client";

import { useMemo, useRef, useState } from "react";
import { MousePointer2, Spline, Eraser, Undo2, RotateCcw, Users, Circle } from "lucide-react";
import { POSITIONS } from "@/lib/types";

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
  group: string; // position group, or "Opponent" / "Ball"
  playerId?: string;
}
interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
type Mode = "move" | "arrow" | "erase";

// ── Pitch geometry (viewBox 100 x 150, attacking upward) ─────────
const W = 100;
const H = 150;

const GROUP_ORDER = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const GROUP_COLOR: Record<string, string> = {
  Goalkeeper: "#f59e0b",
  Defender: "#3b82f6",
  Midfielder: "#22c55e",
  Forward: "#ef4444",
  Opponent: "#64748b",
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

// Formation slots — [x, y] in board space, attacking toward y=0.
const FORMATIONS: { id: string; label: string; slots: [number, number][] }[] = [
  {
    id: "7-231",
    label: "7-a-side · 2-3-1",
    slots: [[50, 142], [34, 118], [66, 118], [22, 86], [50, 90], [78, 86], [50, 44]],
  },
  {
    id: "9-323",
    label: "9-a-side · 3-2-3",
    slots: [[50, 142], [24, 116], [50, 120], [76, 116], [34, 88], [66, 88], [22, 46], [50, 40], [78, 46]],
  },
  {
    id: "11-433",
    label: "11-a-side · 4-3-3",
    slots: [[50, 142], [16, 116], [38, 120], [62, 120], [84, 116], [28, 86], [50, 90], [72, 86], [22, 44], [50, 38], [78, 44]],
  },
  {
    id: "11-442",
    label: "11-a-side · 4-4-2",
    slots: [[50, 142], [16, 116], [38, 120], [62, 120], [84, 116], [16, 84], [40, 88], [60, 88], [84, 84], [38, 42], [62, 42]],
  },
];

let idc = 0;
const uid = (p: string) => `${p}-${++idc}`;

export function TacticalBoard({ teams }: { teams: BoardTeam[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [formationId, setFormationId] = useState(FORMATIONS[0].id);
  const [mode, setMode] = useState<Mode>("move");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [tempArrow, setTempArrow] = useState<Arrow | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const drawing = useRef<boolean>(false);

  const team = teams.find((t) => t.id === teamId);

  // Roster sorted by position group so formations fill sensibly (GK first).
  const roster = useMemo(() => {
    const rs = [...(team?.players ?? [])];
    rs.sort((a, b) => GROUP_ORDER.indexOf(groupOf(a.position)) - GROUP_ORDER.indexOf(groupOf(b.position)));
    return rs;
  }, [team]);

  const placedPlayerIds = new Set(tokens.filter((t) => t.playerId).map((t) => t.playerId));
  const bench = roster.filter((p) => !placedPlayerIds.has(p.id));

  // ── Coordinate conversion ──────────────────────────────────────
  function toBoard(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(2, Math.min(W - 2, ((clientX - rect.left) / rect.width) * W)),
      y: Math.max(2, Math.min(H - 2, ((clientY - rect.top) / rect.height) * H)),
    };
  }

  // ── Token placement ────────────────────────────────────────────
  function placePlayer(p: BoardPlayer, x = 50, y = 75) {
    setTokens((t) => [
      ...t,
      { id: uid("tok"), label: shortLabel(p.full_name), x, y, kind: "player", group: groupOf(p.position), playerId: p.id },
    ]);
  }
  function applyFormation() {
    const formation = FORMATIONS.find((f) => f.id === formationId)!;
    const next: Token[] = formation.slots.map((slot, i) => {
      const p = roster[i];
      return {
        id: uid("tok"),
        label: p ? shortLabel(p.full_name) : `#${i + 1}`,
        x: slot[0],
        y: slot[1],
        kind: "player",
        group: p ? groupOf(p.position) : "Midfielder",
        playerId: p?.id,
      };
    });
    // Keep any existing opponents / ball, replace the player tokens.
    setTokens((t) => [...t.filter((tok) => tok.kind !== "player"), ...next]);
  }
  function addOpponent() {
    setTokens((t) => [...t, { id: uid("opp"), label: "", x: 50, y: 40, kind: "opponent", group: "Opponent" }]);
  }
  function addBall() {
    setTokens((t) => [...t.filter((tok) => tok.kind !== "ball"), { id: uid("ball"), label: "", x: 50, y: 75, kind: "ball", group: "Ball" }]);
  }

  // ── Pointer handlers ───────────────────────────────────────────
  function onTokenDown(e: React.PointerEvent, tok: Token) {
    e.stopPropagation();
    if (mode === "erase") {
      setTokens((t) => t.filter((x) => x.id !== tok.id));
      return;
    }
    if (mode !== "move") return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    drag.current = { id: tok.id, dx: tok.x - x, dy: tok.y - y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onSvgDown(e: React.PointerEvent) {
    if (mode !== "arrow") return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    drawing.current = true;
    setTempArrow({ id: "temp", x1: x, y1: y, x2: x, y2: y });
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }
  function onSvgMove(e: React.PointerEvent) {
    if (drag.current) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      const d = drag.current;
      setTokens((t) => t.map((tok) => (tok.id === d.id ? { ...tok, x: Math.max(2, Math.min(W - 2, x + d.dx)), y: Math.max(2, Math.min(H - 2, y + d.dy)) } : tok)));
    } else if (drawing.current && tempArrow) {
      const { x, y } = toBoard(e.clientX, e.clientY);
      setTempArrow((a) => (a ? { ...a, x2: x, y2: y } : a));
    }
  }
  function onSvgUp() {
    drag.current = null;
    if (drawing.current && tempArrow) {
      const len = Math.hypot(tempArrow.x2 - tempArrow.x1, tempArrow.y2 - tempArrow.y1);
      if (len > 3) setArrows((a) => [...a, { ...tempArrow, id: uid("arr") }]);
    }
    drawing.current = false;
    setTempArrow(null);
  }
  function onArrowDown(e: React.PointerEvent, id: string) {
    if (mode !== "erase") return;
    e.stopPropagation();
    setArrows((a) => a.filter((x) => x.id !== id));
  }

  const modeBtn = (m: Mode, Icon: typeof MousePointer2, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium border ${
        mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        {teams.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="tb-team">Team</label>
            <select
              id="tb-team"
              value={teamId}
              onChange={(e) => { setTeamId(e.target.value); setTokens((t) => t.filter((x) => x.kind !== "player")); }}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.age_group ? ` · ${t.age_group}` : ""}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="tb-formation">Formation</label>
          <select
            id="tb-formation"
            value={formationId}
            onChange={(e) => setFormationId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {FORMATIONS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
          </select>
        </div>
        <button
          type="button"
          onClick={applyFormation}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Users className="size-3.5" aria-hidden="true" />
          Set up XI
        </button>
      </div>

      {/* Mode + add tools */}
      <div className="flex flex-wrap items-center gap-2">
        {modeBtn("move", MousePointer2, "Move")}
        {modeBtn("arrow", Spline, "Arrow")}
        {modeBtn("erase", Eraser, "Erase")}
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={addOpponent} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
          <Circle className="size-3.5" aria-hidden="true" /> Opponent
        </button>
        <button type="button" onClick={addBall} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
          ⚽ Ball
        </button>
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={() => setArrows((a) => a.slice(0, -1))} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
          <Undo2 className="size-3.5" aria-hidden="true" /> Undo arrow
        </button>
        <button type="button" onClick={() => { setTokens((t) => t.filter((x) => x.kind === "player")); setArrows([]); }} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
          <RotateCcw className="size-3.5" aria-hidden="true" /> Clear
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
              style={{ background: "#15803d" }}
              onPointerDown={onSvgDown}
              onPointerMove={onSvgMove}
              onPointerUp={onSvgUp}
            >
              {/* Pitch markings */}
              <g stroke="rgba(255,255,255,0.55)" strokeWidth={0.5} fill="none">
                <rect x={2} y={2} width={W - 4} height={H - 4} rx={1} />
                <line x1={2} y1={H / 2} x2={W - 2} y2={H / 2} />
                <circle cx={W / 2} cy={H / 2} r={11} />
                <circle cx={W / 2} cy={H / 2} r={0.8} fill="rgba(255,255,255,0.55)" />
                {/* Penalty boxes */}
                <rect x={26} y={2} width={48} height={20} />
                <rect x={38} y={2} width={24} height={8} />
                <rect x={26} y={H - 22} width={48} height={20} />
                <rect x={38} y={H - 10} width={24} height={8} />
              </g>

              {/* Arrows */}
              <defs>
                <marker id="tb-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <line
                  key={a.id}
                  x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
                  stroke="#fde047" strokeWidth={1.2} markerEnd="url(#tb-arrow)"
                  style={{ cursor: mode === "erase" ? "pointer" : "default" }}
                  onPointerDown={(e) => onArrowDown(e, a.id)}
                />
              ))}
              {tempArrow && (
                <line x1={tempArrow.x1} y1={tempArrow.y1} x2={tempArrow.x2} y2={tempArrow.y2} stroke="#fde047" strokeWidth={1.2} strokeDasharray="2 1.5" markerEnd="url(#tb-arrow)" />
              )}

              {/* Tokens */}
              {tokens.map((tok) => (
                <g
                  key={tok.id}
                  transform={`translate(${tok.x} ${tok.y})`}
                  onPointerDown={(e) => onTokenDown(e, tok)}
                  style={{ cursor: mode === "move" ? "grab" : mode === "erase" ? "pointer" : "default" }}
                >
                  {tok.kind === "ball" ? (
                    <circle r={2.6} fill="#f8fafc" stroke="#111" strokeWidth={0.4} />
                  ) : (
                    <>
                      <circle r={4.2} fill={GROUP_COLOR[tok.group]} stroke="rgba(0,0,0,0.35)" strokeWidth={0.5} />
                      {tok.label && (
                        <text y={7.6} textAnchor="middle" fontSize={3} fill="#fff" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.55)", strokeWidth: 0.4 }}>
                          {tok.label}
                        </text>
                      )}
                    </>
                  )}
                </g>
              ))}
            </svg>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {mode === "move" && "Drag players, opponents and the ball to position them."}
            {mode === "arrow" && "Drag on the pitch to draw a run or pass."}
            {mode === "erase" && "Tap a player or arrow to remove it."}
          </p>
        </div>

        {/* Bench + legend */}
        <div className="space-y-4">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
