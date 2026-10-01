"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAiArtefactFeedback } from "@/app/actions/ai-feedback";
import type { AiFeedback } from "@/lib/ai-artefacts";

/** A result already stored for this subject, read on the server so it's there on load. */
export interface InitialAiResult {
  artefactId: string;
  text: string;
  generatedAt: string;
  feedback: AiFeedback | null;
}

type ActionResult = {
  error?: string;
  artefactId?: string;
  cached?: boolean;
  persisted?: boolean;
  generatedAt?: string;
  feedback?: AiFeedback | null;
};

/**
 * The state every stored-AI panel shares: the text, when it was made, whether
 * the last click was answered from the store, thumbs feedback with rollback,
 * and the generate / "regenerate anyway" calls. The caller supplies only the
 * action and how to pull its text out of the result.
 */
export function useStoredAi<R extends ActionResult>(
  run: (force: boolean) => Promise<R>,
  pickText: (result: R) => string | undefined,
  initial?: InitialAiResult | null
) {
  const [text, setText] = useState<string | null>(initial?.text || null);
  const [artefactId, setArtefactId] = useState<string | null>(initial?.artefactId ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initial?.generatedAt ?? null);
  const [feedback, setFeedback] = useState<AiFeedback | null>(initial?.feedback ?? null);
  const [unchanged, setUnchanged] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate(force: boolean) {
    setError(null);
    setUnchanged(false);
    start(async () => {
      const result = await run(force);
      if (result.error) { setError(result.error); toast.error(result.error); return; }
      setText(pickText(result) ?? null);
      setArtefactId(result.artefactId ?? null);
      setGeneratedAt(result.generatedAt ?? null);
      setFeedback(result.feedback ?? null);
      setUnchanged(result.cached === true);
      setUnsaved(result.persisted === false);
    });
  }

  function rate(next: AiFeedback | null) {
    const before = feedback;
    setFeedback(next); // optimistic
    if (!artefactId) return;
    void setAiArtefactFeedback(artefactId, next).then((r) => {
      if (r.error) { setFeedback(before); toast.error(r.error); }
    });
  }

  return { text, artefactId, generatedAt, feedback, unchanged, unsaved, error, pending, generate, rate };
}
