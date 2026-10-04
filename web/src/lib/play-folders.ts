// Folders for saved plays, so the board's play list works as a library
// (borrowed from Finalthird's tactical library). A folder is only a name a
// coach types on a play; plays that share a name share a folder. Pure.

export const FOLDER_MAX = 40;

/** The stored form of a typed folder name: trimmed, single-spaced, capped, or null for none. */
export function normaliseFolder(raw: string | null | undefined): string | null {
  const name = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, FOLDER_MAX).trim();
  return name || null;
}

/** Every folder in use, A to Z, each listed once regardless of letter case. */
export function folderNames(plays: { folder?: string | null }[]): string[] {
  const seen = new Map<string, string>();
  for (const p of plays) {
    const name = normaliseFolder(p.folder);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export interface FolderGroup<T> {
  /** Null is the group of plays not in any folder. */
  folder: string | null;
  plays: T[];
}

/**
 * Plays grouped by folder: named folders A to Z, then the unfiled plays last.
 * Order inside a group is kept as given (the list arrives newest first).
 */
export function groupByFolder<T extends { folder?: string | null }>(plays: T[]): FolderGroup<T>[] {
  const names = folderNames(plays);
  const groups: FolderGroup<T>[] = names.map((folder) => ({
    folder,
    plays: plays.filter((p) => normaliseFolder(p.folder)?.toLowerCase() === folder.toLowerCase()),
  }));
  const unfiled = plays.filter((p) => !normaliseFolder(p.folder));
  if (unfiled.length) groups.push({ folder: null, plays: unfiled });
  return groups;
}
