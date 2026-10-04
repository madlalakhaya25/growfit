"use client";

import { useState } from "react";
import { Check, Loader2, Mic, Send, Square, X } from "lucide-react";
import { interpretBoardInstructions } from "@/app/actions/board-instructions";
import { transcribeCoachNote } from "@/app/actions/coach-notes";
import { useVoiceCapture } from "@/components/tactics/use-voice-capture";
import {
  MAX_INSTRUCTION_CHARS, instructionLine, planInstructions, playersMenu, type InstructionPlan,
} from "@/lib/board-instructions";
import type { Shape, Token } from "@/lib/board-model";

/**
 * Tell the board how the shape should move. The coach types or says it, sees
 * the runs drawn as a dashed preview with each action in words, and only
 * pressing Apply puts them on the board (as ordinary arrows the Move panel
 * plays). Nothing is drawn straight from speech or from the model.
 */
export function BoardInstructionsPanel({
  teamId, players, opponents, onPreview, onApply,
}: Readonly<{
  teamId: string;
  players: Token[];
  opponents: Token[];
  /** The dashed runs to show on the pitch while the coach decides; [] clears. */
  onPreview: (shapes: Shape[]) => void;
  /** Add the runs to the board and keep the coach's words with the play. */
  onApply: (shapes: Shape[], sentenceLine: string) => void;
}>) {
  const [sentence, setSentence] = useState("");
  const [busy, setBusy] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [plan, setPlan] = useState<(InstructionPlan & { sentence: string }) | null>(null);

  const voice = useVoiceCapture({
    maxSeconds: 30,
    onCaptured: async ({ blob, ext }) => {
      setHearing(true);
      const form = new FormData();
      form.append("audio", new File([blob], `instruction.${ext}`, { type: blob.type }));
      const res = await transcribeCoachNote(form);
      setHearing(false);
      if (res.error || !res.text) { setNotice(res.error ?? "Couldn't hear that. Try again."); return; }
      setSentence(res.text.replaceAll("\n", " ").slice(0, MAX_INSTRUCTION_CHARS));
    },
  });

  function clear() {
    setPlan(null);
    onPreview([]);
  }

  async function handlePreview() {
    setNotice(null);
    clear();
    if (players.length === 0) { setNotice("Put your players on the board first."); return; }
    setBusy(true);
    const res = await interpretBoardInstructions({
      teamId, sentence, playersMenu: playersMenu(players), count: players.length,
    });
    setBusy(false);
    if (res.error || !res.instructions) { setNotice(res.error ?? "Couldn't read that."); return; }
    const next = planInstructions(players, opponents, res.instructions);
    if (next.planned.length === 0) { setNotice(next.skipped[0] ?? "Nothing to draw for that."); return; }
    setPlan({ ...next, sentence: instructionLine(sentence) });
    onPreview(next.planned.flatMap((p) => (p.shape ? [p.shape] : [])));
  }

  function handleApply() {
    if (!plan) return;
    onApply(plan.planned.flatMap((p) => (p.shape ? [p.shape] : [])), plan.sentence);
    setSentence("");
    clear();
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-2">
      <span className="px-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tell the board</span>
      <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void handlePreview(); }}>
        <input
          type="text"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="Left back overlaps, the 10 drops, strikers press"
          aria-label="Tell the board how to move"
          maxLength={MAX_INSTRUCTION_CHARS}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={voice.recording ? voice.stop : voice.start}
          disabled={hearing || busy}
          aria-label={voice.recording ? "Stop and write it out" : "Say it"}
          title={voice.recording ? `Recording ${voice.seconds}s: tap to stop` : "Say it instead of typing it"}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-50 sm:size-9"
        >
          {hearing && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {!hearing && voice.recording && <Square className="size-3.5 text-destructive" aria-hidden="true" />}
          {!hearing && !voice.recording && <Mic className="size-3.5" aria-hidden="true" />}
        </button>
        <button
          type="submit"
          disabled={busy || !sentence.trim()}
          className="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs hover:bg-muted disabled:opacity-50 sm:h-9"
        >
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Send className="size-3 text-primary" aria-hidden="true" />}
          Preview
        </button>
      </form>
      {voice.error && <p role="alert" className="text-xs text-destructive">{voice.error}</p>}
      {notice && <output className="block text-xs text-muted-foreground">{notice}</output>}
      {plan && (
        <div className="space-y-1.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Dashed on the pitch. Nothing changes until you apply.</p>
          <ul className="space-y-0.5 text-xs">
            {plan.planned.map((p, i) => <li key={`${p.instruction.action}-${i}`}>{p.text}</li>)}
          </ul>
          {plan.skipped.length > 0 && (
            <ul className="space-y-0.5 text-[11px] text-muted-foreground">
              {plan.skipped.map((s) => <li key={s}>Skipped: {s}</li>)}
            </ul>
          )}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex h-10 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground sm:h-9"
            >
              <Check className="size-3.5" aria-hidden="true" /> Apply
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex h-10 items-center gap-1 rounded-md border border-border bg-background px-3 text-xs hover:bg-muted sm:h-9"
            >
              <X className="size-3.5" aria-hidden="true" /> Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
