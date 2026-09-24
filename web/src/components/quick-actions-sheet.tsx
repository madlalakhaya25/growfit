"use client";

import { useState } from "react";
import { Plus, Calendar, Dumbbell, Megaphone } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";

interface Props {
  /** First/current team, so a new fixture or session starts pre-scoped. */
  defaultTeamId?: string;
}

/**
 * The "+" quick-actions sheet from docs/AI_FEATURES_AND_IA.md Part 4 --
 * every option opens an existing page, nothing new to build behind it.
 * "Mark attendance" and "Log a result" aren't here: both only make sense
 * once a specific fixture or session is picked, so they stay where they
 * already are (on that fixture/session's own page) rather than getting a
 * placeholder destination here.
 */
export function QuickActionsSheet({ defaultTeamId }: Props) {
  const [open, setOpen] = useState(false);
  const teamQuery = defaultTeamId ? `?team=${defaultTeamId}` : "";

  return (
    <>
      <Button
        variant="primary"
        size="icon"
        className="rounded-full"
        aria-label="Quick actions"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-5" aria-hidden="true" />
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Quick actions">
        <ListRowGroup>
          <ListRow
            leading={<Calendar className="size-5 text-primary" aria-hidden="true" />}
            title="Schedule a fixture"
            href={`/dashboard/coach/fixtures/new${teamQuery}`}
            onClick={() => setOpen(false)}
          />
          <ListRow
            leading={<Dumbbell className="size-5 text-primary" aria-hidden="true" />}
            title="Plan a training session"
            href={`/dashboard/coach/training/new${teamQuery}`}
            onClick={() => setOpen(false)}
          />
          <ListRow
            leading={<Megaphone className="size-5 text-primary" aria-hidden="true" />}
            title="Post an announcement"
            href="/dashboard/coach/announcements"
            onClick={() => setOpen(false)}
          />
        </ListRowGroup>
      </Sheet>
    </>
  );
}
