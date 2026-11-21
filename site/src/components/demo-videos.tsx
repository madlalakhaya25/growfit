"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

export type DemoClip = {
  id: string;
  title: string;
  blurb: string;
  src: string;
  device: "desktop" | "phone";
};

export function DemoVideos({ clips }: { clips: DemoClip[] }) {
  const [active, setActive] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = clips[active];

  // Autoplay muted on selection, unless the visitor asked for reduced motion.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    v.load();
    if (!reduce) v.play().catch(() => {});
  }, [active]);

  const phone = clip.device === "phone";

  return (
    <section id="demos" className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-16">
      <div className="mb-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#a71817] mb-2">See it in action</p>
        <h2 className="text-4xl font-extrabold tracking-tight">Thirty seconds a feature.</h2>
        <p className="mt-2 text-muted-foreground max-w-lg">
          Real screens from a real academy workflow. Pick a feature to watch it.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-start">
        <div role="tablist" aria-label="Feature demos" aria-orientation="vertical"
          className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0 border-b lg:border-b-0 border-border">
          {clips.map((c, i) => (
            <button key={c.id} role="tab" type="button" aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`shrink-0 text-left px-4 py-3 border transition-colors min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                i === active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40"
              }`}>
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="text-[10px] tabular-nums text-primary/50">{String(i + 1).padStart(2, "0")}</span>
                {c.title}
              </span>
              <span className="mt-1 hidden lg:block text-xs text-muted-foreground leading-snug">{c.blurb}</span>
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-label={clip.title} className="flex flex-col items-center">
          <div className={
            phone
              ? "w-full max-w-[17rem] rounded-[2rem] border-[6px] border-[#0c0c0d] bg-[#0c0c0d] overflow-hidden shadow-xl"
              : "w-full overflow-hidden rounded-lg border border-border bg-[#0c0c0d] shadow-xl"
          }>
            <video ref={videoRef} key={clip.id} controls muted playsInline loop preload="metadata"
              className={`block w-full ${phone ? "aspect-[1080/2336]" : "aspect-video"} bg-[#0c0c0d]`}>
              <source src={clip.src} type="video/mp4" />
              Your browser can&apos;t play this video.
            </video>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground lg:hidden">
            <Play className="size-3.5" aria-hidden="true" /> {clip.blurb}
          </p>
        </div>
      </div>
    </section>
  );
}
