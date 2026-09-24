"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
 */
export function TeamSwitcher({ teams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (teams.length < 2) return null;

  const current = searchParams.get("team") ?? teams[0].id;

  function handleChange(teamId: string) {
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
