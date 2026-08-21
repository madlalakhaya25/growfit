"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Plus, Trash2, UserPlus, CheckCircle2, ImagePlus, X } from "lucide-react";
import { extractPlayersFromPdf, createImportedPlayers, attachHeadshotsToExisting, type ImportRow } from "@/app/actions/player-import";
import { POSITIONS } from "@/lib/types";

// Legacy catch-all values duplicate the specific ones — hide from the picker.
const LEGACY = new Set(["goalkeeper", "defender", "midfielder", "winger", "striker"]);

export interface ImportTeam { id: string; name: string; age_group: string | null }

const blankRow = (): ImportRow => ({
  full_name: "", date_of_birth: null, mysafa_number: null,
  fifa_number: null, id_number: null, age_group: null, position: null, photoDataUrl: null,
  matchedPlayerId: null, matchedPlayerName: null,
});

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function PlayerImportPanel({
  teams,
  defaultTeamId = "",
}: {
  teams: ImportTeam[];
  /** Pre-selected when arriving from a squad, so an import is not orphaned. */
  defaultTeamId?: string;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [attachChecked, setAttachChecked] = useState<Set<number>>(new Set());
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [busy, setBusy] = useState<"extract" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [unassignedPhotos, setUnassignedPhotos] = useState<string[]>([]);
  const [result, setResult] = useState<{ created: number; skipped: string[]; photosAttached: number; attachedToExisting: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const positions = POSITIONS.filter((p) => !LEGACY.has(p.value));
  const photoCount = rows.filter((r) => r.photoDataUrl).length;
  const toCreateCount = rows.filter((r) => !r.matchedPlayerId && r.full_name.trim()).length;
  const toAttachCount = rows.filter((r, i) => r.matchedPlayerId && r.photoDataUrl && attachChecked.has(i)).length;
  const matchedCount = rows.filter((r) => r.matchedPlayerId).length;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    // Fail fast on the client rather than after a long upload.
    if (file.size > 12 * 1024 * 1024) {
      setError("That PDF is over 12 MB. Split it into smaller batches of cards.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setBusy("extract");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await extractPlayersFromPdf(fd);
      if (res.error) { setError(res.error); return; }
      setPhotoWarning(res.photoWarning ?? null);
      setUnassignedPhotos((prev) => [...prev, ...(res.unassignedPhotos ?? [])]);
      const startIndex = rows.length;
      const newRows = (res.players ?? []).map((p) => ({ ...p, position: null }));
      setRows((prev) => [...prev, ...newRows]);
      setAttachChecked((prev) => {
        const next = new Set(prev);
        newRows.forEach((r, i) => {
          if (r.matchedPlayerId && r.photoDataUrl) next.add(startIndex + i);
        });
        return next;
      });
    } catch (err) {
      // Without this the spinner ran forever on any thrown error.
      setError(
        err instanceof Error
          ? `Upload failed: ${err.message}`
          : "Upload failed. Check your connection and try again."
      );
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function update(i: number, patch: Partial<ImportRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function replacePhoto(i: number, file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const dataUrl = await readAsDataUrl(file);
      update(i, { photoDataUrl: dataUrl });
    } catch {
      setError("Could not read that image. Try a different file.");
    }
  }

  async function handleCreate() {
    setError(null);
    setBusy("create");
    try {
      // Matched rows never create a duplicate player. If their attach box is
      // checked and they carry a photo, that photo goes onto the EXISTING
      // player instead; otherwise the row is left out entirely.
      const toCreate = rows.filter((r) => !r.matchedPlayerId);
      const toAttach = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r, i }) => r.matchedPlayerId && r.photoDataUrl && attachChecked.has(i));

      const [createRes, attachRes] = await Promise.all([
        toCreate.length > 0
          ? createImportedPlayers({ rows: toCreate, teamId: teamId || undefined })
          : Promise.resolve({ created: 0, skipped: [], photosAttached: 0 }),
        toAttach.length > 0
          ? attachHeadshotsToExisting(toAttach.map(({ r }) => ({ playerId: r.matchedPlayerId!, photoDataUrl: r.photoDataUrl! })))
          : Promise.resolve({ attached: 0 }),
      ]);

      if ("error" in createRes && createRes.error) { setError(createRes.error); return; }
      if ("error" in attachRes && attachRes.error) { setError(attachRes.error); return; }

      setResult({
        created: createRes.created ?? 0,
        skipped: createRes.skipped ?? [],
        photosAttached: createRes.photosAttached ?? 0,
        attachedToExisting: attachRes.attached ?? 0,
      });
      setRows([]);
      setAttachChecked(new Set());
      setUnassignedPhotos([]);
      setPhotoWarning(null);
    } catch (err) {
      setError(err instanceof Error ? `Could not create players: ${err.message}` : "Could not create players.");
    } finally {
      setBusy(null);
    }
  }

  const cell = "w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm">Upload registration cards</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A SAFA registration PDF with one or more player cards. Names, dates of birth,
            registration numbers, and a headshot where the card has one are read off it —
            you check everything, photo included, before anything is created. The file
            itself is not stored.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            {busy === "extract" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
            {busy === "extract" ? "Reading…" : "Choose PDF"}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={handleFile}
              disabled={busy !== null}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, blankRow()])}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden="true" /> Add manually
          </button>
        </div>

        {busy === "extract" && (
          <p className="text-xs text-muted-foreground">Reading the cards — this takes a few seconds.</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {photoWarning && (
          <p className="text-sm text-amber-600 dark:text-amber-500">{photoWarning}</p>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            {result.created} player{result.created === 1 ? "" : "s"} created
          </p>
          {result.photosAttached > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.photosAttached} photo{result.photosAttached === 1 ? "" : "s"} attached automatically.
              A coach or admin can change any player&apos;s photo from their profile at any time.
            </p>
          )}
          {result.attachedToExisting > 0 && (
            <p className="text-xs text-muted-foreground">
              {result.attachedToExisting} photo{result.attachedToExisting === 1 ? "" : "s"} attached to
              players already registered — no new player was created for them.
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Skipped as already registered: {result.skipped.join(", ")}
            </p>
          )}
          {result.created > 0 && (
            <p className="text-xs text-muted-foreground">
              {teamId
                ? `Added to ${teams.find((t) => t.id === teamId)?.name ?? "the squad"}.`
                : "They are in your academy but not in a squad yet, so they will not appear on a squad page. Add them from Squad, then Add player."}
            </p>
          )}
        </div>
      )}

      {/* Photos read off the document that no card identified an owner for.
          Shown rather than discarded so the reviewer can place them. */}
      {unassignedPhotos.length > 0 && rows.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">
              Unassigned photo{unassignedPhotos.length === 1 ? "" : "s"} ({unassignedPhotos.length})
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These came off the document but their card didn&apos;t identify a player. Pick who each
              belongs to, or leave them — nothing is attached unless you choose.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {unassignedPhotos.map((dataUrl, pi) => (
              <div key={pi} className="w-32 space-y-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUrl} alt="" className="h-32 w-32 rounded-lg border border-border object-cover" />
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const rowIdx = Number(e.target.value);
                    if (Number.isNaN(rowIdx)) return;
                    update(rowIdx, { photoDataUrl: dataUrl });
                    if (rows[rowIdx]?.matchedPlayerId) {
                      setAttachChecked((prev) => new Set(prev).add(rowIdx));
                    }
                    setUnassignedPhotos((prev) => prev.filter((_, idx) => idx !== pi));
                  }}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Assign to…</option>
                  {rows.map((r, ri) => (
                    <option key={ri} value={ri}>{r.full_name || `Row ${ri + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review table */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Check before creating ({rows.length})</p>
              {photoCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {photoCount} photo{photoCount === 1 ? "" : "s"} matched by the registration number on
                  each card — still worth a glance before creating.
                </p>
              )}
              {matchedCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {matchedCount} row{matchedCount === 1 ? "" : "s"} already registered — highlighted
                  below. Nothing new is created for them; tick the box to attach their photo instead.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setRows([]); setUnassignedPhotos([]); setPhotoWarning(null); }}
              className="text-xs text-muted-foreground underline"
            >
              Clear all
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Photo</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Date of birth</th>
                  <th className="px-3 py-2 font-medium">SAFA no.</th>
                  <th className="px-3 py-2 font-medium">FIFA ID</th>
                  <th className="px-3 py-2 font-medium">Position</th>
                  <th className="px-3 py-2 font-medium sr-only">Remove</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  r.matchedPlayerId ? (
                  <tr key={i} className="border-b border-border last:border-0 bg-amber-500/5">
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <label
                          className="relative block size-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-muted"
                          title={r.photoDataUrl ? "Replace photo" : "Add a photo"}
                        >
                          {r.photoDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photoDataUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center">
                              <ImagePlus className="size-4 text-muted-foreground" aria-hidden="true" />
                            </span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            aria-label={`Photo, row ${i + 1}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void replacePhoto(i, file);
                                setAttachChecked((prev) => new Set(prev).add(i));
                              }
                              e.target.value = "";
                            }}
                            className="sr-only"
                          />
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2" colSpan={4}>
                      <p className="text-xs font-medium">Already registered — {r.matchedPlayerName}</p>
                      <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          disabled={!r.photoDataUrl}
                          checked={attachChecked.has(i)}
                          onChange={(e) =>
                            setAttachChecked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(i); else next.delete(i);
                              return next;
                            })
                          }
                        />
                        {r.photoDataUrl
                          ? `Attach this photo to ${r.matchedPlayerName}\u2019s profile \u2014 no new player is created for them.`
                          : "No photo on this card to attach — nothing happens for this row unless you add one."}
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                        aria-label={`Remove row ${i + 1}`}
                        className="rounded border border-border bg-background p-1.5 hover:bg-muted"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  ) : (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1">
                        <label
                          className="relative block size-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-muted"
                          title={r.photoDataUrl ? "Replace photo" : "Add a photo"}
                        >
                          {r.photoDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.photoDataUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center">
                              <ImagePlus className="size-4 text-muted-foreground" aria-hidden="true" />
                            </span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            aria-label={`Photo, row ${i + 1}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void replacePhoto(i, file);
                              e.target.value = "";
                            }}
                            className="sr-only"
                          />
                        </label>
                        {r.photoDataUrl && (
                          <button
                            type="button"
                            onClick={() => update(i, { photoDataUrl: null })}
                            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-2.5" aria-hidden="true" /> Clear
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Name, row ${i + 1}`}
                        value={r.full_name}
                        onChange={(e) => update(i, { full_name: e.target.value })}
                        placeholder="Full name"
                        className={cell}
                      />
                      {r.age_group && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">{r.age_group}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Date of birth, row ${i + 1}`}
                        type="date"
                        value={r.date_of_birth ?? ""}
                        onChange={(e) => update(i, { date_of_birth: e.target.value || null })}
                        className={cell}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`SAFA number, row ${i + 1}`}
                        value={r.mysafa_number ?? ""}
                        onChange={(e) => update(i, { mysafa_number: e.target.value || null })}
                        className={cell}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`FIFA ID, row ${i + 1}`}
                        value={r.fifa_number ?? ""}
                        onChange={(e) => update(i, { fifa_number: e.target.value || null })}
                        className={cell}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        aria-label={`Position, row ${i + 1}`}
                        value={r.position ?? ""}
                        onChange={(e) => update(i, { position: e.target.value || null })}
                        className={cell}
                      >
                        <option value="">Not set</option>
                        {positions.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                        aria-label={`Remove row ${i + 1}`}
                        className="rounded border border-border bg-background p-1.5 hover:bg-muted"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            {teams.length > 0 && (
              <select
                aria-label="Add to squad"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No squad yet — add them later</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    Add to {t.name}{t.age_group ? ` · ${t.age_group}` : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy !== null || (toCreateCount === 0 && toAttachCount === 0)}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "create" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
              {busy === "create"
                ? "Working…"
                : [
                    toCreateCount > 0 ? `Create ${toCreateCount} player${toCreateCount === 1 ? "" : "s"}` : null,
                    toAttachCount > 0 ? `attach ${toAttachCount} photo${toAttachCount === 1 ? "" : "s"}` : null,
                  ].filter(Boolean).join(" & ") || "Nothing to do"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
