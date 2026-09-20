"use client";

import { useRef, useState } from "react";
import { Loader2, ImagePlus, UserPlus, Download, CheckCircle2 } from "lucide-react";
import { createImportedPlayers } from "@/app/actions/player-import";
import { POSITIONS } from "@/lib/types";

const LEGACY = new Set(["goalkeeper", "defender", "midfielder", "winger", "striker"]);

export interface ManualCardTeam { id: string; name: string; age_group: string | null }

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Manual entry for a player already registered and verified elsewhere (SAFA's
 * own MySAFA system) but with no card PDF on file yet. Creates the player
 * record — reusing the same creation path the PDF importer uses, so photo
 * upload and duplicate handling behave identically either way — then offers
 * the generated card PDF for download.
 */
export function ManualPlayerCardForm({ teams }: { teams: ManualCardTeam[] }) {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [mysafa, setMysafa] = useState("");
  const [fifa, setFifa] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [position, setPosition] = useState("");
  const [teamId, setTeamId] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const positions = POSITIONS.filter((p) => !LEGACY.has(p.value));

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file for the photo."); return; }
    try {
      setPhotoDataUrl(await readAsDataUrl(file));
    } catch {
      setError("Could not read that image.");
    }
  }

  function reset() {
    setFullName(""); setDob(""); setMysafa(""); setFifa(""); setIdNumber("");
    setPosition(""); setPhotoDataUrl(null); setCreated(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError("Enter the player's full name."); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await createImportedPlayers({
        rows: [{
          full_name: fullName.trim(),
          date_of_birth: dob || null,
          mysafa_number: mysafa.trim() || null,
          fifa_number: fifa.trim() || null,
          id_number: idNumber.trim() || null,
          age_group: null,
          photoDataUrl,
          matchedPlayerId: null,
          matchedPlayerName: null,
          position: position || null,
        }],
        teamId: teamId || undefined,
      });
      if (res.error) { setError(res.error); return; }
      if (!res.playerIds || res.playerIds.length === 0) {
        setError(
          res.skipped?.length
            ? "A player with that registration number already exists."
            : "Could not create the player."
        );
        return;
      }
      setCreated({ id: res.playerIds[0], name: fullName.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the player.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
          {created.name} created
        </p>
        <p className="text-xs text-muted-foreground">
          Their registration card is ready — same format as an uploaded SAFA card, with a QR
          code linking to their Growfit passport.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/players/${created.id}/card`}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Download className="size-4" aria-hidden="true" /> Download card PDF
          </a>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-background px-4 text-sm hover:bg-muted"
          >
            Add another player
          </button>
        </div>
      </div>
    );
  }

  const field = "w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="font-semibold text-sm">Enter their details</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          For a player already registered and verified with SAFA who has no card on file yet.
          This creates their profile and generates a card in the same format an uploaded card
          would produce.
        </p>
      </div>

      <div className="flex items-start gap-4">
        <label
          className="relative block size-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border bg-muted"
          title={photoDataUrl ? "Replace photo" : "Add a photo"}
        >
          {photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoDataUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
              <ImagePlus className="size-5" aria-hidden="true" />
              <span className="text-[10px]">Photo</span>
            </span>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="sr-only" />
        </label>

        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <label htmlFor="mp-name" className="text-xs font-medium text-muted-foreground">Full name *</label>
            <input id="mp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Anelisa Ngidi" required className={field} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="mp-dob" className="text-xs font-medium text-muted-foreground">Date of birth</label>
              <input id="mp-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={field} />
            </div>
            <div className="space-y-1">
              <label htmlFor="mp-position" className="text-xs font-medium text-muted-foreground">Position</label>
              <select id="mp-position" value={position} onChange={(e) => setPosition(e.target.value)} className={field}>
                <option value="">Not set</option>
                {positions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="mp-mysafa" className="text-xs font-medium text-muted-foreground">MySAFA number</label>
          <input id="mp-mysafa" value={mysafa} onChange={(e) => setMysafa(e.target.value)} placeholder="e.g. 0VX7S" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="mp-fifa" className="text-xs font-medium text-muted-foreground">FIFA Connect ID</label>
          <input id="mp-fifa" value={fifa} onChange={(e) => setFifa(e.target.value)} placeholder="e.g. 1P7BXZ7" className={field} />
        </div>
        <div className="space-y-1">
          <label htmlFor="mp-id" className="text-xs font-medium text-muted-foreground">SA ID number</label>
          <input id="mp-id" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={13} className={field} />
        </div>
      </div>

      {teams.length > 0 && (
        <div className="space-y-1 sm:max-w-xs">
          <label htmlFor="mp-team" className="text-xs font-medium text-muted-foreground">Add to squad</label>
          <select id="mp-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className={field}>
            <option value="">No squad yet — add them later</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.age_group ? ` · ${t.age_group}` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
        {busy ? "Creating…" : "Create player & generate card"}
      </button>
    </form>
  );
}
