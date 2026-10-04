"use client";

import { useState, useTransition } from "react";
import { BookOpen, ChevronDown, PlayCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteDrill, setAcademyMethod } from "@/app/actions/drills";
import { themeLabel, fourCornerLabel } from "@/lib/drill-library";
import type { LibraryDrillRow, LibraryPlay } from "@/lib/drill-library-data";
import { DrillPlayThumb } from "./drill-play-thumb";
import { LibraryDrillForm } from "./library-drill-form";

export interface RowPermissions {
  isAdmin: boolean;
  canPlan: boolean;
  tagsReady: boolean;
}

function summary(d: LibraryDrillRow): string {
  return [
    d.age_groups.join(" · "),
    d.themes.map(themeLabel).join(", "),
    d.duration_minutes ? `${d.duration_minutes} min` : "",
    d.players_needed ? `${d.players_needed} players` : "",
  ].filter(Boolean).join(" · ");
}

function DrillFacts({ drill, play }: Readonly<{ drill: LibraryDrillRow; play: LibraryPlay | undefined }>) {
  return (
    <div className="space-y-3 text-sm">
      {play && <DrillPlayThumb play={play.data} name={play.name} uid={`${drill.id}-lg`} size="lg" />}
      {drill.description && <p className="whitespace-pre-line">{drill.description}</p>}
      {drill.coaching_points && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coaching points</p>
          <p className="whitespace-pre-line">{drill.coaching_points}</p>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
        {drill.four_corner && (<><dt>4-corner</dt><dd className="text-foreground">{fourCornerLabel(drill.four_corner)}</dd></>)}
        {drill.equipment && (<><dt>Equipment</dt><dd className="text-foreground">{drill.equipment}</dd></>)}
      </dl>
      {drill.video_url && (
        <a href={drill.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-primary">
          <PlayCircle className="size-4" aria-hidden="true" /> Watch video
        </a>
      )}
    </div>
  );
}

function DrillActions({ drill, perms, onPlan, onEdit }: Readonly<{
  drill: LibraryDrillRow;
  perms: RowPermissions;
  onPlan: () => void;
  onEdit: () => void;
}>) {
  const [pending, start] = useTransition();
  const canChange = !drill.is_academy_method || perms.isAdmin;

  function run(action: () => Promise<{ error?: string; success?: boolean }>, ok: string) {
    start(async () => {
      const res = await action();
      if (res?.error) toast.error(res.error);
      else toast.success(ok);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {perms.canPlan && <Button type="button" className="h-11" onClick={onPlan}>Add to session</Button>}
      {canChange && <Button type="button" variant="outline" className="h-11" onClick={onEdit}>Edit</Button>}
      {perms.isAdmin && perms.tagsReady && (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={() =>
            run(() => setAcademyMethod(drill.id, !drill.is_academy_method),
              drill.is_academy_method ? "No longer the academy method." : "Marked as the academy method.")}
        >
          <Star className="size-4" aria-hidden="true" />
          {drill.is_academy_method ? "Unmark academy method" : "Mark as academy method"}
        </Button>
      )}
      {canChange && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 text-destructive"
          disabled={pending}
          onClick={() => {
            if (globalThis.confirm(`Remove "${drill.name}" from the library?`)) run(() => deleteDrill(drill.id), "Removed.");
          }}
        >
          Remove
        </Button>
      )}
    </div>
  );
}

export function LibraryDrillListItem({ drill, play, plays, perms, onPlan }: Readonly<{
  drill: LibraryDrillRow;
  play: LibraryPlay | undefined;
  plays: readonly LibraryPlay[];
  perms: RowPermissions;
  onPlan: () => void;
}>) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const facts = summary(drill);

  return (
    <li className="px-4 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 text-left"
      >
        {play ? (
          <DrillPlayThumb play={play.data} name={play.name} uid={drill.id} />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
            <BookOpen className="size-5" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium leading-snug">{drill.name}</span>
            {drill.is_academy_method && (
              <Badge variant="brand"><Star className="size-3" aria-hidden="true" />Academy method</Badge>
            )}
          </span>
          {facts && <span className="block truncate text-sm text-muted-foreground">{facts}</span>}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 pb-3 pt-2">
          {editing ? (
            <LibraryDrillForm drill={drill} plays={plays} tagsReady={perms.tagsReady} onDone={() => setEditing(false)} />
          ) : (
            <>
              <DrillFacts drill={drill} play={play} />
              <DrillActions drill={drill} perms={perms} onPlan={onPlan} onEdit={() => setEditing(true)} />
            </>
          )}
        </div>
      )}
    </li>
  );
}
