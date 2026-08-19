"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Plus, Trash2, UserPlus, CheckCircle2 } from "lucide-react";
import { extractPlayersFromPdf, createImportedPlayers, type ImportRow } from "@/app/actions/player-import";
import { POSITIONS } from "@/lib/types";

// Legacy catch-all values duplicate the specific ones — hide from the picker.
const LEGACY = new Set(["goalkeeper", "defender", "midfielder", "winger", "striker"]);

export interface ImportTeam { id: string; name: string; age_group: string | null }

const blankRow = (): ImportRow => ({
  full_name: "", date_of_birth: null, mysafa_number: null,
  fifa_number: null, id_number: null, age_group: null, position: null,
});

export function PlayerImportPanel({ teams }: { teams: ImportTeam[] }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState<"extract" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const positions = POSITIONS.filter((p) => !LEGACY.has(p.value));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy("extract");

    const fd = new FormData();
    fd.append("file", file);
    const res = await extractPlayersFromPdf(fd);
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";

    if (res.error) { setError(res.error); return; }
    setRows((prev) => [...prev, ...(res.players ?? []).map((p) => ({ ...p, position: null }))]);
  }

  function update(i: number, patch: Partial<ImportRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleCreate() {
    setError(null);
    setBusy("create");
    const res = await createImportedPlayers({ rows, teamId: teamId || undefined });
    setBusy(null);
    if (res.error) { setError(res.error); return; }
    setResult({ created: res.created ?? 0, skipped: res.skipped ?? [] });
    setRows([]);
  }

  const cell = "w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <p className="font-semibold text-sm">Upload registration cards</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A SAFA registration PDF with one or more player cards. Names, dates of birth
            and registration numbers are read off it — you check them before anything is
            created. The file itself is not stored.
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
      </div>

      {result && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
            {result.created} player{result.created === 1 ? "" : "s"} created
          </p>
          {result.skipped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Skipped as already registered: {result.skipped.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Review table */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Check before creating ({rows.length})</p>
            <button
              type="button"
              onClick={() => setRows([])}
              className="text-xs text-muted-foreground underline"
            >
              Clear all
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
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
                  <tr key={i} className="border-b border-border last:border-0">
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
                <option value="">Don&apos;t add to a squad yet</option>
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
              disabled={busy !== null || rows.every((r) => !r.full_name.trim())}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "create" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
              {busy === "create" ? "Creating…" : `Create ${rows.filter((r) => r.full_name.trim()).length} player(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
