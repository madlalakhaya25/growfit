"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

interface AnnouncementRow {
  id: string;
  team_id: string;
  title: string;
}

interface Props {
  teamIds: string[];
}

export function AnnouncementNotifier({ teamIds }: Props) {
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!teamIds.length) return;

    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel("announcement-inserts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
        },
        (payload: RealtimePostgresInsertPayload<AnnouncementRow>) => {
          const announcement = payload.new;

          if (!teamIds.includes(announcement.team_id)) return;
          if (seenIds.current.has(announcement.id)) return;
          seenIds.current.add(announcement.id);

          toast("New announcement", {
            description: announcement.title,
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
