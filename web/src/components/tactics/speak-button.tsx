"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Reads AI output aloud using the browser's built-in speech synthesis — for a
 * coach at the touchline who can't read a screen. Nothing is uploaded or
 * stored; if the browser has no speech support the button simply doesn't render.
 */
export function SpeakButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  if (!supported || !text.trim()) return null;

  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // Strip the section labels so it reads as speech rather than a form.
    const spoken = text.replace(/^[A-Z][A-Z 0-9/&'-]{2,}:/gm, (m) => m.slice(0, -1) + ".");
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.rate = 0.98;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
      aria-label={speaking ? "Stop reading aloud" : "Read aloud"}
    >
      {speaking ? <VolumeX className="size-3" aria-hidden="true" /> : <Volume2 className="size-3 text-primary" aria-hidden="true" />}
      {speaking ? "Stop" : label}
    </button>
  );
}
