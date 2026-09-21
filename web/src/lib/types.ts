/**
 * Domain types — ported from the Expo app (framework-agnostic).
 * These mirror the Supabase schema and are shared across screens.
 */

export type UserRole = "admin" | "coach" | "player" | "parent";

export type FixtureStatus = "upcoming" | "completed" | "cancelled" | "postponed";

export type Position =
  // Granular positions
  | "gk" | "cb" | "sw" | "lb" | "rb" | "lwb" | "rwb"
  | "cdm" | "cm" | "lm" | "rm" | "cam"
  | "lw" | "rw" | "ss" | "cf" | "st"
  // Legacy (kept for backward compat)
  | "goalkeeper" | "defender" | "midfielder" | "winger" | "striker";

export type Foot = "left" | "right" | "both";

/**
 * Whether a player can actually be picked right now — distinct from their
 * registration/active status. Squad selection (by hand and by the AI) used
 * to have no way to know a player was injured, even though the AI's own
 * system prompt already forbids suggesting one play (docs/BACKLOG.md 1.2).
 */
export type AvailabilityStatus = "available" | "injured" | "unavailable";

export interface Academy {
  id: string;
  name: string;
  location: string | null;
  province: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  academy_id: string | null;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  profile_id: string | null;
  academy_id: string;
  full_name: string;
  date_of_birth: string | null;
  position: Position | null;
  secondary_pos: Position | null;
  preferred_foot: Foot | null;
  photo_url: string | null;
  share_token: string;
  active: boolean;
  availability_status: AvailabilityStatus;
  availability_note: string | null;
  availability_updated_at: string | null;
  availability_updated_by: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  academy_id: string;
  name: string;
  age_group: string | null;
  coach_id: string | null;
  invite_code: string;
  active: boolean;
  created_at: string;
}

export interface Fixture {
  id: string;
  team_id: string;
  opponent: string;
  venue: string | null;
  fixture_date: string;
  is_home: boolean;
  status: FixtureStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PlayerRating {
  id: string;
  fixture_id: string;
  player_id: string;
  coach_id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string | null;
  created_at: string;
}

export const POSITIONS: { value: Position; label: string; group: string }[] = [
  // Goalkeepers
  { value: "gk",  label: "Goalkeeper (GK)",           group: "Goalkeeper" },
  // Defenders
  { value: "cb",  label: "Centre Back (CB)",           group: "Defender" },
  { value: "sw",  label: "Sweeper (SW)",               group: "Defender" },
  { value: "lb",  label: "Left Back (LB)",             group: "Defender" },
  { value: "rb",  label: "Right Back (RB)",            group: "Defender" },
  { value: "lwb", label: "Left Wing Back (LWB)",       group: "Defender" },
  { value: "rwb", label: "Right Wing Back (RWB)",      group: "Defender" },
  // Midfielders
  { value: "cdm", label: "Defensive Midfielder (CDM)", group: "Midfielder" },
  { value: "cm",  label: "Central Midfielder (CM)",    group: "Midfielder" },
  { value: "lm",  label: "Left Midfielder (LM)",       group: "Midfielder" },
  { value: "rm",  label: "Right Midfielder (RM)",      group: "Midfielder" },
  { value: "cam", label: "Attacking Midfielder (CAM)", group: "Midfielder" },
  // Forwards
  { value: "lw",  label: "Left Winger (LW)",           group: "Forward" },
  { value: "rw",  label: "Right Winger (RW)",          group: "Forward" },
  { value: "ss",  label: "Second Striker (SS)",        group: "Forward" },
  { value: "cf",  label: "Centre Forward (CF)",        group: "Forward" },
  { value: "st",  label: "Striker (ST)",               group: "Forward" },
  // Legacy
  { value: "goalkeeper", label: "Goalkeeper",          group: "Goalkeeper" },
  { value: "defender",   label: "Defender",            group: "Defender" },
  { value: "midfielder", label: "Midfielder",          group: "Midfielder" },
  { value: "winger",     label: "Winger",              group: "Forward" },
  { value: "striker",    label: "Striker",             group: "Forward" },
];

export const FEET: { value: Foot; label: string }[] = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
  { value: "both", label: "Both" },
];

export const AVAILABILITY_STATUSES: { value: AvailabilityStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "injured", label: "Injured" },
  { value: "unavailable", label: "Unavailable" },
];

export const AGE_GROUPS = [
  "U10",
  "U12",
  "U13",
  "U15",
  "U17",
  "U19",
  "U21",
  "Senior",
];
