"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateDrill } from "@/app/actions/drills";

const CATEGORIES = [
  { value: "warm_up", label: "Warm-up" },
  { value: "technical", label: "Technical" },
  { value: "tactical", label: "Tactical" },
  { value: "physical", label: "Physical" },
  { value: "small_sided", label: "Small-sided" },
  { value: "cool_down", label: "Cool-down" },
] as const;

const DIFFICULTIES = [
  { value: "", label: "No level set" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

/**
 * Mirrors the unions `drills.ts` validates against. Declared here rather
 * than imported because that file is `"use server"` — only async functions
 * may be exported from one.
 */
type DrillCategory = (typeof CATEGORIES)[number]["value"];
type DrillDifficulty = Exclude<(typeof DIFFICULTIES)[number]["value"], "">;

const inputCls =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface EditableDrill {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number | null;
  difficulty: string | null;
  video_url: string | null;
}

/**
 * Edit a drill in the reusable library.
 *
 * The library supported add and delete only, so correcting a duration or a
 * dead video link meant deleting the drill and retyping it from scratch.
 *
 * Sessions copy a drill's content when they pull it in rather than
 * referencing it, so editing here changes the library entry and any future
 * session that uses it — sessions already built keep what they had. That is
 * the right behaviour (a past session should stay a record of what was
 * actually run) but it is worth knowing, so the form says so.
 */
export function EditDrillButton({
  drill,
  children,
}: {
  drill: EditableDrill;
  /** The row's display markup, which stays a Server Component. Swapped out
   *  while editing rather than rendered alongside the form. */
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(formData: FormData) {
    setError(null);
    const durationRaw = formData.get("duration_minutes") as string;

    start(async () => {
      const res = await updateDrill(drill.id, {
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        category: formData.get("category") as DrillCategory,
        duration_minutes: durationRaw ? Number(durationRaw) : undefined,
        difficulty: ((formData.get("difficulty") as string) || undefined) as
          | DrillDifficulty
          | undefined,
        video_url: (formData.get("video_url") as string) || undefined,
      });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Drill updated.");
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <>
        {children}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit drill: ${drill.name}`}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
      </>
    );
  }

  return (
    <form action={handleSave} className="min-w-0 flex-1 space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`name-${drill.id}`} className="text-sm font-medium">Name *</label>
        <input id={`name-${drill.id}`} name="name" required defaultValue={drill.name} className={inputCls} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor={`category-${drill.id}`} className="text-sm font-medium">Category</label>
          <select id={`category-${drill.id}`} name="category" defaultValue={drill.category} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`difficulty-${drill.id}`} className="text-sm font-medium">Level</label>
          <select id={`difficulty-${drill.id}`} name="difficulty" defaultValue={drill.difficulty ?? ""} className={inputCls}>
            {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`duration-${drill.id}`} className="text-sm font-medium">Minutes</label>
          <input id={`duration-${drill.id}`} name="duration_minutes" type="number" min={1} max={180}
            defaultValue={drill.duration_minutes ?? ""} className={inputCls} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`description-${drill.id}`} className="text-sm font-medium">Description</label>
        <textarea id={`description-${drill.id}`} name="description" rows={3} defaultValue={drill.description ?? ""}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`video-${drill.id}`} className="text-sm font-medium">Video link</label>
        <input id={`video-${drill.id}`} name="video_url" type="url" defaultValue={drill.video_url ?? ""}
          placeholder="https://youtube.com/…" className={inputCls} />
      </div>

      <p className="text-xs text-muted-foreground">
        Sessions already built keep the version of this drill they were given —
        a past session stays a record of what was actually run.
      </p>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={pending}>
          <Check className="size-3.5" aria-hidden="true" />
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" type="button" variant="outline" disabled={pending}
          onClick={() => { setEditing(false); setError(null); }}>
          <X className="size-3.5" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </form>
  );
}
