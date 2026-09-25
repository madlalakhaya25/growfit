"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { readCurrentTeamCookie, resolveCurrentTeamId, writeCurrentTeamCookie } from "@/lib/current-team";

interface Team {
  id: string;
  name: string;
  age_group: string | null;
}

interface Props {
  teams: Team[];
}

/**
 * For a coach who runs more than one team (Buhle: U11, U13, U15) --
 * updates the `?team=` query param the squad/fixtures/training pages
 * already read, on whichever page is currently open. A no-op on a page
 * that doesn't read that param (Today, Announcements) rather than
 * something that needs wiring per-page -- see docs/AI_FEATURES_AND_IA.md
 * Part 4 and PR3's own description for the scoping reasoning.
 *
 * Also writes `lib/current-team.ts`'s cookie on change, so a page with no
 * `?team=` in its links (or the quick-actions "+" button, or the assistant
 * panel) still agrees on which team the coach picked last, instead of each
 * falling back to its own guess.
 */
export function TeamSwitcher({ teams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // A cookie isn't knowable during the server render, so reading it
  // synchronously here would make the client's first render disagree with
  // the server-rendered HTML (`?team=` alone is always in sync, since it
  // comes from the URL both sides already agree on). One real client pass
  // after mount, same pattern as sheet.tsx's `mounted` flag.
  const [cookieTeamId, setCookieTeamId] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setCookieTeamId(readCurrentTeamCookie()), []);

  if (teams.length < 2) return null;

  const current = resolveCurrentTeamId(teams, searchParams.get("team"), cookieTeamId) ?? teams[0].id;

  function handleChange(teamId: string) {
    writeCurrentTeamCookie(teamId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("team", teamId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="sr-only">Team</span>
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-border bg-transparent py-1.5 pl-2 pr-1 text-sm font-medium"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.age_group ? ` · ${t.age_group}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
