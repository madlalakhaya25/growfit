// Players no longer read tactic_plays directly (migration 070): a row read
// cannot hide the other players' private coach notes inside `data`. They use
// two functions instead. Until 070 runs the functions do not exist, so callers
// fall back to the old direct read.

/** PostgREST PGRST202 / Postgres 42883: the function is not there (yet). */
export function isMissingFunction(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export interface SharedPlayRow {
  id: string;
  name: string;
  notes: string | null;
  share_token: string;
  concept_ids: string[] | null;
  voice_url: string | null;
  updated_at: string;
  team_name: string | null;
}
