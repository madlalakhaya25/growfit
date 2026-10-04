"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveDrill, updateDrill, type DrillInput } from "@/app/actions/drills";
import { tagsFromFormData } from "@/lib/drill-library";
import { DrillTagFields, type DrillTagDefaults } from "./drill-tag-fields";

const CATEGORIES = [
  { value: "warm_up", label: "Warm-up" },
  { value: "technical", label: "Technical" },
  { value: "tactical", label: "Tactical" },
  { value: "physical", label: "Physical" },
  { value: "small_sided", label: "Small-sided game" },
  { value: "cool_down", label: "Cool-down" },
] as const;

const DIFFICULTIES = [
  { value: "", label: "Any level" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

const inputCls =
  "flex h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface EditableLibraryDrill extends DrillTagDefaults {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number | null;
  difficulty: string | null;
  video_url: string | null;
}

function inputFromForm(fd: FormData): DrillInput {
  const text = (k: string) => (fd.get(k) as string | null) || undefined;
  const minutes = text("duration_minutes");
  return {
    name: (fd.get("name") as string) ?? "",
    description: text("description"),
    category: fd.get("category") as DrillInput["category"],
    duration_minutes: minutes ? Number(minutes) : undefined,
    difficulty: text("difficulty") as DrillInput["difficulty"],
    video_url: text("video_url"),
    ...tagsFromFormData(fd),
  };
}

/**
 * Add a drill to the academy library, or edit one (`drill` given). Sessions
 * copy a drill when they pull it in, so an edit changes future sessions only.
 */
export function LibraryDrillForm({
  drill,
  plays,
  tagsReady,
  onDone,
}: Readonly<{
  drill?: EditableLibraryDrill;
  plays: readonly { id: string; name: string }[];
  tagsReady: boolean;
  onDone?: () => void;
}>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const idp = drill ? `edit-${drill.id}` : "new-drill";
  const submitLabel = drill ? "Save changes" : "Add to library";

  function submit(fd: FormData) {
    setError(null);
    const input = inputFromForm(fd);
    start(async () => {
      const res = drill ? await updateDrill(drill.id, input) : await saveDrill(input);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(drill ? "Drill updated." : "Added to the library.");
      onDone?.();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={`${idp}-name`} className="text-sm font-medium">Name</label>
        <input id={`${idp}-name`} name="name" required maxLength={120} defaultValue={drill?.name ?? ""}
          placeholder="e.g. 4v1 rondo" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${idp}-category`} className="text-sm font-medium">Kind</label>
          <select id={`${idp}-category`} name="category" required defaultValue={drill?.category ?? "technical"} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idp}-minutes`} className="text-sm font-medium">Minutes</label>
          <input id={`${idp}-minutes`} name="duration_minutes" type="number" min={1} max={180}
            defaultValue={drill?.duration_minutes ?? ""} placeholder="e.g. 15" className={inputCls} />
        </div>
      </div>

      {tagsReady && <DrillTagFields idPrefix={idp} defaults={drill} plays={plays} />}

      <div className="space-y-1.5">
        <label htmlFor={`${idp}-description`} className="text-sm font-medium">How it works</label>
        <textarea id={`${idp}-description`} name="description" rows={3} maxLength={500} defaultValue={drill?.description ?? ""}
          placeholder="Set-up and rules, in a few lines"
          className="flex w-full resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${idp}-level`} className="text-sm font-medium">Level</label>
          <select id={`${idp}-level`} name="difficulty" defaultValue={drill?.difficulty ?? ""} className={inputCls}>
            {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${idp}-video`} className="text-sm font-medium">Video link</label>
          <input id={`${idp}-video`} name="video_url" type="url" defaultValue={drill?.video_url ?? ""}
            placeholder="https://…" className={inputCls} />
        </div>
      </div>

      {drill && (
        <p className="text-xs text-muted-foreground">
          Sessions already planned keep the version they were given.
        </p>
      )}

      {error && <p role="alert" className="rounded-[10px] bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
