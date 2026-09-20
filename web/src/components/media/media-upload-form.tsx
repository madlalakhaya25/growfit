"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { uploadMedia } from "@/app/actions/media";
import { Button } from "@/components/ui/button";

interface Props {
  teamId: string;
  sessionId?: string;
  fixtureId?: string;
  academyId: string;
  squadPlayers?: { id: string; full_name: string }[];
}

export function MediaUploadForm({
  teamId,
  sessionId,
  fixtureId,
  academyId,
  squadPlayers,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ success?: boolean; error?: string } | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(e.target.files?.[0]?.name ?? null);
    setStatus(null);
  }

  function togglePlayer(id: string) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;

    const fd = new FormData(formRef.current);

    // Remove any stale player_id entries and re-append selected ones
    // FormData doesn't support deleting, so we build a fresh one
    const finalFd = new FormData();
    for (const [key, value] of fd.entries()) {
      if (key !== "player_id") finalFd.append(key, value);
    }
    for (const pid of selectedPlayers) {
      finalFd.append("player_id", pid);
    }

    startTransition(async () => {
      const result = await uploadMedia(finalFd);
      if (result?.error) {
        setStatus({ error: result.error });
        toast.error(result.error);
      } else {
        setStatus({ success: true });
        toast.success("Uploaded!");
        formRef.current?.reset();
        setFileName(null);
        setSelectedPlayers([]);
        setTimeout(() => setStatus(null), 3000);
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={open ? "ghost" : "primary"}
        size="sm"
        className="gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        {!open && <Camera className="size-4" aria-hidden="true" />}
        {open ? "Cancel" : "Add photo / video"}
      </Button>

      {open && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-4 space-y-4"
        >
          {/* Hidden context fields */}
          <input type="hidden" name="academy_id" value={academyId} />
          <input type="hidden" name="team_id" value={teamId} />
          {sessionId && <input type="hidden" name="session_id" value={sessionId} />}
          {fixtureId && <input type="hidden" name="fixture_id" value={fixtureId} />}

          {/* File picker */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              File <span className="text-destructive">*</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">
              <span className="shrink-0 font-medium text-foreground">Choose file</span>
              <span className="min-w-0 truncate">{fileName ?? "No file selected"}</span>
              <input
                type="file"
                name="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={handleFileChange}
                required
              />
            </label>
          </div>

          {/* Caption */}
          <div className="space-y-1">
            <label htmlFor="media-caption" className="text-sm font-medium text-foreground">
              Caption <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="media-caption"
              type="text"
              name="caption"
              placeholder="Add a caption…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Player tags */}
          {squadPlayers && squadPlayers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Tag players <span className="text-muted-foreground font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {squadPlayers.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={selectedPlayers.includes(p.id)}
                      onChange={() => togglePlayer(p.id)}
                    />
                    <span className="truncate">{p.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Status messages */}
          {status?.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {status.error}
            </p>
          )}
          {status?.success && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              Uploaded!
            </p>
          )}

          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      )}
    </div>
  );
}
