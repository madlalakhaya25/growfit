import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { sanitiseAgeGroups, sanitiseThemes, isFourCorner, type LibraryAgeGroup, type DrillTheme, type FourCorner } from "@/lib/drill-library";
import type { PlayData } from "@/components/tactics/play-viewer";

/**
 * Reads for the academy drill library. Migration 065's tag columns may not
 * have run yet: a select naming them fails outright (42703), so the read falls
 * back to migration 012's columns and reports `tagsReady: false`, and the page
 * shows a "not set up yet" note instead of an empty library.
 */

const BASE_COLUMNS = "id, name, description, category, duration_minutes, difficulty, video_url";
const TAG_COLUMNS =
  "id, name, description, category, duration_minutes, difficulty, video_url, age_groups, themes, four_corner, players_needed, equipment, coaching_points, tactic_play_id, is_academy_method";

export interface LibraryDrillRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number | null;
  difficulty: string | null;
  video_url: string | null;
  age_groups: LibraryAgeGroup[];
  themes: DrillTheme[];
  four_corner: FourCorner | null;
  players_needed: number | null;
  equipment: string | null;
  coaching_points: string | null;
  tactic_play_id: string | null;
  is_academy_method: boolean;
}

export interface LibraryPlay {
  id: string;
  name: string;
  data: PlayData;
}

// The Supabase client is generated without database types in this project.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

function normalise(r: Record<string, unknown>): LibraryDrillRow {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    description: (r.description as string | null) ?? null,
    category: String(r.category ?? "technical"),
    duration_minutes: (r.duration_minutes as number | null) ?? null,
    difficulty: (r.difficulty as string | null) ?? null,
    video_url: (r.video_url as string | null) ?? null,
    age_groups: sanitiseAgeGroups(r.age_groups),
    themes: sanitiseThemes(r.themes),
    four_corner: isFourCorner(r.four_corner) ? r.four_corner : null,
    players_needed: (r.players_needed as number | null) ?? null,
    equipment: (r.equipment as string | null) ?? null,
    coaching_points: (r.coaching_points as string | null) ?? null,
    tactic_play_id: (r.tactic_play_id as string | null) ?? null,
    is_academy_method: r.is_academy_method === true,
  };
}

export async function loadLibraryDrills(
  supabase: Client,
  academyId: string
): Promise<{ drills: LibraryDrillRow[]; tagsReady: boolean }> {
  const full = await supabase.from("drill_library").select(TAG_COLUMNS).eq("academy_id", academyId).order("name");
  if (!full.error) {
    return { drills: ((full.data ?? []) as Record<string, unknown>[]).map(normalise), tagsReady: true };
  }
  if (!isMissingAttributeColumn(full.error)) return { drills: [], tagsReady: true };

  const legacy = await supabase.from("drill_library").select(BASE_COLUMNS).eq("academy_id", academyId).order("name");
  return { drills: ((legacy.data ?? []) as Record<string, unknown>[]).map(normalise), tagsReady: false };
}

/** The academy's saved board plays, for the diagram picker and thumbnails. */
export async function loadLibraryPlays(supabase: Client, academyId: string): Promise<LibraryPlay[]> {
  const { data } = await supabase
    .from("tactic_plays")
    .select("id, name, data")
    .eq("academy_id", academyId)
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as { id: string; name: string; data: PlayData | null }[]).map((p) => ({
    id: p.id,
    name: p.name,
    data: p.data ?? {},
  }));
}

export interface SessionChoice {
  id: string;
  title: string;
  session_date: string;
  team_name: string | null;
}

/** Sessions from today on, on teams this user coaches, for "Add to session". */
export async function loadUpcomingSessions(supabase: Client, teamIds: string[], nowIso: string): Promise<SessionChoice[]> {
  if (teamIds.length === 0) return [];
  const { data } = await supabase
    .from("training_sessions")
    .select("id, title, session_date, teams ( name )")
    .in("team_id", teamIds)
    .gte("session_date", nowIso.slice(0, 10))
    .order("session_date")
    .limit(20);
  type Raw = { id: string; title: string; session_date: string; teams: { name: string } | { name: string }[] | null };
  return ((data ?? []) as Raw[]).map((s) => {
    const team = Array.isArray(s.teams) ? s.teams[0] : s.teams;
    return { id: s.id, title: s.title, session_date: s.session_date, team_name: team?.name ?? null };
  });
}
