"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { formatWeekdayDayMonth } from "@/lib/time";

interface FixtureRow {
  id: string;
  team_id: string;
  opponent: string;
  fixture_date: string;
  is_home: boolean;
}

interface Props {
  teamIds: string[]; // the player's active team IDs
}

export function FixtureNotifier({ teamIds }: Props) {
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!teamIds.length) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel("fixture-inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fixtures",
        },
        (payload: RealtimePostgresInsertPayload<FixtureRow>) => {
          const fixture = payload.new;

          // Only notify for this player's teams and deduplicate
          if (!teamIds.includes(fixture.team_id)) return;
          if (seenIds.current.has(fixture.id)) return;
          seenIds.current.add(fixture.id);

          const date = formatWeekdayDayMonth(fixture.fixture_date);
          const venue = fixture.is_home ? "Home" : "Away";

          toast("New fixture added", {
            description: `${venue} vs ${fixture.opponent} · ${date}`,
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamIds]);

  return null;
}
