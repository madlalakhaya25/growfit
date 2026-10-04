"use client";

import { useState, useTransition } from "react";
import { Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { shareSessionDrillToLibrary } from "@/app/actions/drills";
import { tagsFromFormData, type LibraryAgeGroup } from "@/lib/drill-library";
import { DrillTagFields } from "./drill-tag-fields";

/**
 * "Share to library" on a session drill: copies it into the academy library
 * with the age groups and themes it suits, so the other age groups can run it
 * the same way. The session's own age group is ticked to start with.
 */
export function ShareToLibraryButton({
  sessionDrillId,
  drillTitle,
  teamAgeGroup,
}: Readonly<{ sessionDrillId: string; drillTitle: string; teamAgeGroup: LibraryAgeGroup | null }>) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    start(async () => {
      const res = await shareSessionDrillToLibrary(sessionDrillId, {
        ...tagsFromFormData(fd),
        category: (fd.get("category") as string) || undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Shared to the academy library.");
      setShared(true);
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 text-muted-foreground"
        disabled={shared}
        onClick={() => setOpen(true)}
        aria-label={shared ? `${drillTitle} is in the library` : `Share ${drillTitle} to the library`}
      >
        <Share className="size-4" aria-hidden="true" />
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Share to library">
        <form action={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{drillTitle}</span> goes into the academy library for every coach.
            Who is it for, and what does it train?
          </p>
          <div className="space-y-1.5">
            <label htmlFor={`share-${sessionDrillId}-kind`} className="text-sm font-medium">Kind</label>
            <select id={`share-${sessionDrillId}-kind`} name="category" defaultValue="technical"
              className="flex h-11 w-full rounded-[10px] border border-input bg-background px-3 text-sm">
              <option value="warm_up">Warm-up</option>
              <option value="technical">Technical</option>
              <option value="tactical">Tactical</option>
              <option value="physical">Physical</option>
              <option value="small_sided">Small-sided game</option>
              <option value="cool_down">Cool-down</option>
            </select>
          </div>
          <DrillTagFields idPrefix={`share-${sessionDrillId}`} compact defaults={{ age_groups: teamAgeGroup ? [teamAgeGroup] : [] }} />
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "Sharing…" : "Share to library"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
