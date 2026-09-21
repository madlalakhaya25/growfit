"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload, Video, Camera, ArrowUpRight, Minus, Waves, Pencil, Square as SquareIcon,
  Type, Eraser, Undo2, Redo2, RotateCcw, Download, Save, FolderOpen, Trash2, Play as PlayIcon, Send,
} from "lucide-react";
import {
  dribblePath, polyPath, shapeColor, shapeWidth, toBoardSpace,
  type Shape, type ShapeKind,
} from "@/lib/board-model";
import { captureVideoFrame, loadImageFile } from "@/lib/image-capture";
import { parseEmbedUrl, isTrustedEmbedUrl, type EmbedProvider } from "@/lib/video-embed";
import { savePlay, listPlays, loadPlay, deletePlay, sharePlayToSquad, type SavedPlaySummary } from "@/app/actions/tactic-plays";
import { VoiceNoteRecorder } from "@/components/tactics/voice-note-recorder";

export interface FilmTeam {
  id: string;
  name: string;
}

/** Drawing tools that make sense on a still frame — no tokens exist here
 * (there's no squad to place on a photo), so "spotlight" (bound to a
 * token's playerId — see board-model.ts) isn't offered; everything else
 * from the pitch board's tool set is. */
type Mode = "run" | "pass" | "dribble" | "free" | "zone" | "text" | "erase";

/** Width/height of the annotation percentage-space used for a live embed —
 * there's no fixed pixel frame to size against (see EMBED_CANVAS below). */
const EMBED_CANVAS = { w: 100, h: 56.25 }; // 16:9

/** What a saved film play's `data` actually holds. `surface: "film"`
 * distinguishes it from a pitch play sharing the same tactic_plays row
 * shape; `sourceKind` records how the breakdown was captured, purely for
 * the coach's own reference (re-opening never re-fetches the original
 * video, nor re-resolves an embed's provider). An 'embed' breakdown has no
 * `frameImage` at all — a cross-origin iframe exposes no pixels to canvas,
 * so there is no still to persist; only the live annotations + a deep link
 * back to the original video are saved. */
interface FilmData {
  surface: "film";
  sourceKind: "local-video" | "local-image" | "embed";
  frameImage?: string; // data URL — present for local-video/local-image only
  frameW?: number;
  frameH?: number;
  embedUrl?: string;   // present for embed only
  embedProvider?: EmbedProvider;
  shapes: Shape[];
}

let idc = 0;
const uid = (p: string) => `${p}-${++idc}-${Date.now().toString(36)}`;

export function FilmBoard({ teams }: { teams: FilmTeam[] }) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");

  // ── Source capture ────────────────────────────────────────────
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ dataUrl: string; w: number; h: number } | null>(null);
  const [sourceKind, setSourceKind] = useState<FilmData["sourceKind"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // A YouTube/Vimeo link — see the EMBED_CANVAS comment. The player and the
  // drawing overlay can't both have pointer events at once (whichever sits
  // on top intercepts them), so `embedInteractive` toggles which one does:
  // off (default) draws, on lets the coach reach the video's own controls.
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [embedProvider, setEmbedProvider] = useState<EmbedProvider | null>(null);
  const [embedInput, setEmbedInput] = useState("");
  const [embedInteractive, setEmbedInteractive] = useState(false);

  /** The annotation surface's own size, in whatever units its shapes' `pts`
   * are in — a captured frame's real pixel dimensions, or the fixed
   * percentage space an embed's shapes are drawn in. Everything downstream
   * (toBoard, rendering, export gating) reads this instead of `frame`
   * directly so it works for either source. Named to avoid colliding with
   * the *actual* `<canvas>` elements exportPng()/freezeFrame() create. */
  const surface = frame ?? (embedUrl ? EMBED_CANVAS : null);

  // ── Drawing ───────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("free");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const past = useRef<Shape[][]>([]);
  const future = useRef<Shape[][]>([]);

  // ── Saved plays ───────────────────────────────────────────────
  const [plays, setPlays] = useState<SavedPlaySummary[]>([]);
  const [playName, setPlayName] = useState("");
  const [currentPlayId, setCurrentPlayId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);

  function handleFile(file: File) {
    setNotice(null);
    if (file.type.startsWith("video/")) {
      setSourceKind("local-video");
      setFrame(null);
      setVideoUrl(URL.createObjectURL(file));
    } else if (file.type.startsWith("image/")) {
      setSourceKind("local-image");
      setVideoUrl(null);
      loadImageFile(file)
        .then((f) => setFrame(f))
        .catch((err) => setNotice(err instanceof Error ? err.message : "Could not read that file."));
    } else {
      setNotice("Choose a video or image file.");
    }
  }

  function freezeFrame() {
    const video = videoRef.current;
    if (!video) return;
    const captured = captureVideoFrame(video);
    if (!captured) { setNotice("Play or scrub the clip to a frame first."); return; }
    setFrame(captured);
    setNotice(null);
  }

  function chooseAnotherSource() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setFrame(null);
    setSourceKind(null);
    setEmbedUrl(null);
    setEmbedProvider(null);
    setEmbedInput("");
    setEmbedInteractive(false);
    setShapes([]);
    past.current = [];
    future.current = [];
    setCurrentPlayId(null);
    setPlayName("");
    setVoiceUrl(null);
  }

  function connectEmbed() {
    const parsed = parseEmbedUrl(embedInput);
    if (!parsed) { setNotice("That doesn't look like a YouTube or Vimeo link."); return; }
    setNotice(null);
    setSourceKind("embed");
    setVideoUrl(null);
    setFrame(null);
    setEmbedUrl(parsed.embedUrl);
    setEmbedProvider(parsed.provider);
  }

  // ── History ───────────────────────────────────────────────────
  function snapshot() {
    past.current.push(JSON.parse(JSON.stringify(shapes)) as Shape[]);
    if (past.current.length > 40) past.current.shift();
    future.current = [];
  }
  function undo() {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(JSON.parse(JSON.stringify(shapes)) as Shape[]);
    setShapes(prev);
  }
  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(JSON.parse(JSON.stringify(shapes)) as Shape[]);
    setShapes(next);
  }

  // ── Coordinates (board space = the still's own pixel dimensions) ──
  function toBoard(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    return toBoardSpace(rect, clientX, clientY, surface?.w ?? 1, surface?.h ?? 1);
  }

  function onSvgDown(e: React.PointerEvent) {
    if (mode === "erase") return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    if (mode === "text") {
      const text = window.prompt("Label text (e.g. a player's name or an instruction):");
      if (!text || !text.trim()) return;
      snapshot();
      setShapes((s) => [...s, { id: uid("s"), kind: "text", pts: [{ x, y }], text: text.trim().slice(0, 60) }]);
      return;
    }
    drawing.current = true;
    setDraft({ id: "draft", kind: mode as ShapeKind, pts: [{ x, y }, { x, y }] });
    svgRef.current?.setPointerCapture?.(e.pointerId);
  }
  function onSvgMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const { x, y } = toBoard(e.clientX, e.clientY);
    setDraft((d) => {
      if (!d) return d;
      if (d.kind === "free" || d.kind === "zone") return { ...d, pts: [...d.pts, { x, y }] };
      return { ...d, pts: [d.pts[0], { x, y }] };
    });
  }
  function onSvgUp() {
    if (drawing.current && draft) {
      const a = draft.pts[0], b = draft.pts[draft.pts.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) > (surface ? surface.w * 0.01 : 3)) {
        snapshot();
        setShapes((s) => [...s, { ...draft, id: uid("s") }]);
      }
    }
    drawing.current = false;
    setDraft(null);
  }
  function onShapeDown(e: React.PointerEvent, id: string) {
    if (mode !== "erase") return;
    e.stopPropagation();
    snapshot();
    setShapes((s) => s.filter((sh) => sh.id !== id));
  }
  function clearShapes() {
    snapshot();
    setShapes([]);
  }

  function renderShape(sh: Shape, isDraft = false) {
    const stroke = shapeColor(sh);
    const common = {
      stroke, strokeWidth: shapeWidth(sh) * (surface ? surface.w / 100 : 1), fill: "none",
      strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
      opacity: isDraft ? 0.75 : 1,
      style: { cursor: mode === "erase" ? "pointer" : "default" },
      // onShapeDown calls snapshot(), which reads a ref -- but only once
      // this handler actually fires from a real pointer event, never during
      // the render that creates this closure. Same false-positive shape as
      // tactical-board.tsx's identical pattern.
      // eslint-disable-next-line react-hooks/refs
      onPointerDown: isDraft ? undefined : (e: React.PointerEvent) => onShapeDown(e, sh.id),
    };
    const a = sh.pts[0], b = sh.pts[sh.pts.length - 1];
    if (!a) return null;
    if (sh.kind === "text") {
      const size = (surface?.w ?? 100) * 0.03;
      return (
        <text key={sh.id} x={a.x} y={a.y} fontSize={size} fill={stroke} fontWeight="bold"
          style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.7)", strokeWidth: size * 0.15, cursor: mode === "erase" ? "pointer" : "default" }}
          onPointerDown={isDraft ? undefined : (e) => onShapeDown(e, sh.id)}>
          {sh.text}
        </text>
      );
    }
    if (!b) return null;
    if (sh.kind === "free") return <path key={sh.id} d={polyPath(sh.pts)} {...common} />;
    if (sh.kind === "zone") return <path key={sh.id} d={polyPath(sh.pts) + " Z"} {...common} fill={stroke} fillOpacity={0.18} />;
    if (sh.kind === "dribble") return <path key={sh.id} d={dribblePath(a.x, a.y, b.x, b.y)} markerEnd="url(#fb-arrow)" {...common} />;
    return (
      <line key={sh.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        strokeDasharray={sh.kind === "pass" ? `${(surface?.w ?? 100) * 0.03} ${(surface?.w ?? 100) * 0.02}` : undefined}
        markerEnd="url(#fb-arrow)" {...common} />
    );
  }

  // ── Export ────────────────────────────────────────────────────
  function exportPng() {
    const svg = svgRef.current;
    if (!svg || !frame) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(frame.w));
    clone.setAttribute("height", String(frame.h));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = frame.w;
      canvas.height = frame.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      // The still is always local (a data URL — see image-capture.ts), so
      // this canvas is never cross-origin-tainted the way a Supabase-hosted
      // image would be; toBlob is safe to call unconditionally here.
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(playName || "breakdown").trim()}.png`.replace(/\s+/g, "-").toLowerCase();
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  }

  // ── Save / load ───────────────────────────────────────────────
  async function refreshPlays(id = teamId) {
    if (!id) return;
    const res = await listPlays(id, "film");
    if (res.plays) setPlays(res.plays);
  }
  useEffect(() => {
    // Fetch-on-dependency-change: refreshPlays is async and its setState
    // call (setPlays) happens after an await, not synchronously in this
    // effect body -- same false-positive shape as tactical-board.tsx's
    // identical pattern (see that file's comment for the full reasoning).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshPlays(teamId);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [teamId]);

  async function handleSave() {
    const name = playName.trim();
    if (!name) { setNotice("Give the breakdown a name first."); return; }
    if (!sourceKind) { setNotice("Capture a frame or connect a video before saving."); return; }
    if (!teamId) { setNotice("Pick a team first."); return; }
    setBusy("save");
    const data: FilmData = frame
      ? { surface: "film", sourceKind, frameImage: frame.dataUrl, frameW: frame.w, frameH: frame.h, shapes }
      : { surface: "film", sourceKind, embedUrl: embedUrl ?? undefined, embedProvider: embedProvider ?? undefined, shapes };
    const res = await savePlay({ playId: currentPlayId ?? undefined, teamId, name, data, surface: "film" });
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
    if (res.error || !res.data) { setNotice(res.error ?? "Could not load breakdown."); return; }
    const d = res.data as Partial<FilmData>;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setSourceKind(d.sourceKind ?? "local-image");
    setFrame(d.frameImage ? { dataUrl: d.frameImage, w: d.frameW ?? 1280, h: d.frameH ?? 720 } : null);
    // Stored data is arbitrary JSONB (see app/actions/tactic-plays.ts) —
    // never load a saved embedUrl into the iframe without re-confirming
    // it's still one of the two hosts parseEmbedUrl() actually produces.
    const trustedEmbedUrl = isTrustedEmbedUrl(d.embedUrl) ? d.embedUrl! : null;
    setEmbedUrl(trustedEmbedUrl);
    setEmbedProvider(trustedEmbedUrl ? d.embedProvider ?? null : null);
    setEmbedInteractive(false);
    setShapes(d.shapes ?? []);
    past.current = [];
    future.current = [];
    setCurrentPlayId(id);
    setPlayName(res.name ?? "");
    // loadPlay() only returns name/notes/data — voice_url lives on the
    // already-fetched list summary, same pattern tactical-board.tsx uses.
    setVoiceUrl(plays.find((p) => p.id === id)?.voice_url ?? null);
    setNotice(`Loaded "${res.name}".`);
  }

  async function handleDelete(id: string) {
    setBusy("delete");
    const res = await deletePlay(id);
    setBusy(null);
    if (res.error) { setNotice(res.error); return; }
    if (currentPlayId === id) setCurrentPlayId(null);
    setNotice("Breakdown deleted.");
    void refreshPlays();
  }

  async function handleShare() {
    const name = playName.trim();
    if (!name) { setNotice("Name and save the breakdown before sharing."); return; }
    if (!currentPlayId) { setNotice("Save the breakdown before sharing it."); return; }
    setBusy("share");
    const res = await sharePlayToSquad({ teamId, playId: currentPlayId, playName: name });
    setBusy(null);
    setNotice(res.error ?? `Shared "${name}" with the squad.`);
  }

  const toolBtn = (m: Mode, Icon: typeof ArrowUpRight, label: string) => (
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

  // ── Source picker (no frame captured yet) ────────────────────────
  if (!surface) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Pick a video clip from your phone or a photo. The clip plays right here and
            never uploads anywhere — only the still frame you freeze and draw on gets saved.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="size-4" aria-hidden="true" />
            Choose a video or photo
          </button>
          {notice && <p className="text-sm text-destructive">{notice}</p>}
        </div>

        {/* videoUrl only ever comes from URL.createObjectURL(file) below — a
            local blob: URL, never a remote/attacker string — but pin that
            explicitly right at the sink rather than trusting state never
            drifts. */}
        {videoUrl && videoUrl.startsWith("blob:") && (
          <div className="mx-auto w-full max-w-md space-y-3">
            {/* codeql[js/xss-through-dom] — CodeQL's file-input taint source
                model flags this unconditionally; `file` never leaves this
                browser (URL.createObjectURL produces a same-origin blob:
                URL for a video the same user just picked from their own
                disk), and the startsWith("blob:") check above pins the
                scheme regardless. Not exploitable: there's no remote
                attacker in this data flow, only the viewer's own file. */}
            <video ref={videoRef} src={videoUrl} controls playsInline className="w-full rounded-xl border border-border bg-black" />
            <button
              type="button"
              onClick={freezeFrame}
              className="mx-auto flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Camera className="size-4" aria-hidden="true" /> Freeze this frame
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Play or scrub to the moment you want, then freeze it — the video itself is discarded once you do.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Or draw over a YouTube / Vimeo video
          </p>
          <p className="text-xs text-muted-foreground">
            A browser can&apos;t read pixels out of another site&apos;s video player, so there&apos;s
            no still frame here — you draw on a live transparent layer over the playing video instead,
            and only your drawing plus the link get saved (no PNG export for this source).
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={embedInput}
              onChange={(e) => setEmbedInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") connectEmbed(); }}
              placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
            />
            <button
              type="button"
              onClick={connectEmbed}
              className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
            >
              Connect
            </button>
          </div>
        </div>

        {plays.length > 0 && (
          <SavedFilmList plays={plays} onLoad={handleLoad} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {teams.length > 1 && (
          <select
            value={teamId}
            aria-label="Team"
            onChange={(e) => { setTeamId(e.target.value); void refreshPlays(e.target.value); }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <input
          type="text"
          value={playName}
          onChange={(e) => setPlayName(e.target.value)}
          placeholder="Name this breakdown…"
          className="h-9 min-w-[10rem] flex-1 rounded-md border border-border bg-background px-2.5 text-sm"
        />
        <button type="button" onClick={handleSave} disabled={busy === "save"} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          <Save className="size-3.5" aria-hidden="true" /> {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={busy === "share" || !currentPlayId}
          title={currentPlayId ? "Share with the squad" : "Save the breakdown first"}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
        >
          <Send className="size-3.5 text-primary" aria-hidden="true" /> {busy === "share" ? "Sharing…" : "Share"}
        </button>
        <button type="button" onClick={chooseAnotherSource} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted">
          <Video className="size-3.5" aria-hidden="true" /> New source
        </button>
      </div>

      {currentPlayId && (
        <VoiceNoteRecorder
          key={currentPlayId}
          playId={currentPlayId}
          initialUrl={voiceUrl}
          onChange={setVoiceUrl}
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {toolBtn("run", ArrowUpRight, "Run")}
        {toolBtn("pass", Minus, "Pass")}
        {toolBtn("dribble", Waves, "Dribble")}
        {toolBtn("free", Pencil, "Draw")}
        {toolBtn("zone", SquareIcon, "Zone")}
        {toolBtn("text", Type, "Label")}
        {toolBtn("erase", Eraser, "Erase")}
        <span className="mx-1 h-6 w-px bg-border" />
        <button type="button" onClick={undo} title="Undo" className="inline-flex h-10 sm:h-9 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted"><Undo2 className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={redo} title="Redo" className="inline-flex h-10 sm:h-9 items-center rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted"><Redo2 className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={clearShapes} className="inline-flex h-10 sm:h-9 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted">
          <RotateCcw className="size-3.5" aria-hidden="true" /> Clear
        </button>
        <button
          type="button"
          onClick={exportPng}
          disabled={!frame}
          title={frame ? undefined : "PNG export needs a captured frame — a live video embed has no still to export"}
          className="inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="size-3.5 text-primary" aria-hidden="true" /> PNG
        </button>
        {embedUrl && (
          <button
            type="button"
            onClick={() => setEmbedInteractive((v) => !v)}
            title="Toggle whether clicks reach the video's own controls or your drawing"
            className={`inline-flex h-10 sm:h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
              embedInteractive ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
            }`}
          >
            <PlayIcon className="size-3.5" aria-hidden="true" /> {embedInteractive ? "Video controls" : "Drawing"}
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="mx-auto w-full max-w-2xl">
          <div className="relative overflow-hidden rounded-xl border border-border bg-black" style={{ aspectRatio: `${surface.w} / ${surface.h}` }}>
            {/* codeql[js/xss-through-dom] — the guard on this line already
                restricts embedUrl to exactly two hosts
                (www.youtube-nocookie.com, player.vimeo.com — see
                lib/video-embed.ts's isTrustedEmbedUrl), so this can never
                render an arbitrary domain; CodeQL's taint model flags the
                text-input source itself regardless of that runtime check. */}
            {embedUrl && isTrustedEmbedUrl(embedUrl) ? (
              <iframe
                src={embedUrl}
                title="Match video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : null}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${surface.w} ${surface.h}`}
              className="absolute inset-0 h-full w-full touch-none select-none"
              style={embedUrl ? { pointerEvents: embedInteractive ? "none" : "auto" } : undefined}
              onPointerDown={onSvgDown}
              onPointerMove={onSvgMove}
              onPointerUp={onSvgUp}
              onPointerLeave={onSvgUp}
            >
              <defs>
                <marker id="fb-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#fde047" />
                </marker>
              </defs>
              {frame && (
                <image href={frame.dataUrl} x={0} y={0} width={frame.w} height={frame.h} preserveAspectRatio="xMidYMid slice" />
              )}
              {shapes.map((sh) => renderShape(sh))}
              {draft && renderShape(draft, true)}
            </svg>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {embedUrl && embedInteractive
              ? "Video controls active — play, pause or seek, then switch back to Drawing to keep annotating."
              : <>
                  {mode === "run" && "Drag to draw a run (solid arrow)."}
                  {mode === "pass" && "Drag to draw a pass (dashed arrow)."}
                  {mode === "dribble" && "Drag to draw a dribble (wavy line)."}
                  {mode === "free" && "Draw freehand to circle or sketch."}
                  {mode === "zone" && "Draw freehand to shade a space."}
                  {mode === "text" && "Tap where you want a label."}
                  {mode === "erase" && "Tap a line or label to remove it."}
                </>
            }
          </p>
          {notice && <p className="mt-1 text-center text-xs text-muted-foreground">{notice}</p>}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="size-3.5 text-primary" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Saved breakdowns</p>
            </div>
            {plays.length === 0 ? (
              <p className="text-xs text-muted-foreground">No breakdowns saved for this team yet.</p>
            ) : (
              <ul className="space-y-1">
                {plays.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5">
                    <button type="button" onClick={() => handleLoad(p.id)} disabled={busy === "load"} className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50">
                      {p.name}
                    </button>
                    <button type="button" onClick={() => handleDelete(p.id)} disabled={busy === "delete"} title="Delete" className="rounded-md border border-border bg-background px-2 py-1.5 hover:bg-muted disabled:opacity-50">
                      <Trash2 className="size-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The source-picker screen's "or open a saved one" shortcut — purely
 * presentational, fed by the parent's own `plays` state (kept fresh by its
 * useEffect on teamId) rather than fetching again itself. */
function SavedFilmList({
  plays,
  onLoad,
}: {
  plays: SavedPlaySummary[];
  onLoad: (id: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-md space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <PlayIcon className="size-3.5" aria-hidden="true" /> Or open a saved one
      </p>
      <ul className="space-y-1">
        {plays.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onLoad(p.id)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted">
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
