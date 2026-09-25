"use client";
import { useActionState, useTransition } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addPlayerClip, deletePlayerClip } from "@/app/actions/clips";
import { formatDayMonth } from "@/lib/time";

interface Fixture {
  id: string;
  opponent: string;
  fixture_date: string;
}

interface Clip {
  id: string;
  title: string;
  url: string;
  timestamp_seconds: number | null;
  description: string | null;
  created_at: string;
  fixture_id: string | null;
}

interface Props {
  playerId: string;
  clips: Clip[];
  fixtures: Fixture[];
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function DeleteClipButton({ clipId, playerId }: { clipId: string; playerId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
      onClick={() =>
        startTransition(async () => {
          await deletePlayerClip(clipId, playerId);
        })
      }
    >
      <Trash2 className="size-4" aria-hidden="true" />
      <span className="sr-only">Delete clip</span>
    </Button>
  );
}

export function ClipsSection({ playerId, clips, fixtures }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | null, formData: FormData) => {
      const fixture_id = formData.get("fixture_id") as string;
      const ts = formData.get("timestamp_seconds") as string;
      return await addPlayerClip(playerId, {
        title: formData.get("title") as string,
        url: formData.get("url") as string,
        fixture_id: fixture_id || undefined,
        timestamp_seconds: ts ? Number(ts) : undefined,
        description: (formData.get("description") as string) || undefined,
      });
    },
    null
  );

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Video Clips</h2>

      {clips.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {clips.map((clip) => (
            <div key={clip.id} className="flex items-start gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="font-medium leading-snug">{clip.title}</p>
                  {clip.timestamp_seconds !== null && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">
                      {formatTimestamp(clip.timestamp_seconds)}
                    </span>
                  )}
                </div>
                {clip.description && (
                  <p className="text-sm text-muted-foreground">{clip.description}</p>
                )}
                <a
                  href={clip.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                >
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Watch clip
                </a>
              </div>
              <DeleteClipButton clipId={clip.id} playerId={playerId} />
            </div>
          ))}
        </div>
      )}

      {clips.length === 0 && (
        <p className="text-sm text-muted-foreground">No clips yet.</p>
      )}

      <form action={formAction} className="rounded-xl border border-dashed border-border p-4 space-y-4">
        <h3 className="text-sm font-semibold">Add clip</h3>

        <div className="space-y-1.5">
          <label htmlFor="clip-title" className="text-sm font-medium">Title *</label>
          <input
            id="clip-title"
            name="title"
            required
            placeholder="e.g. Great header vs Lions"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="clip-url" className="text-sm font-medium">YouTube / Vimeo URL *</label>
          <input
            id="clip-url"
            name="url"
            type="url"
            required
            placeholder="https://youtube.com/…"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="clip-ts" className="text-sm font-medium">Timestamp (seconds)</label>
            <input
              id="clip-ts"
              name="timestamp_seconds"
              type="number"
              min={0}
              placeholder="e.g. 63 = 1:03"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {fixtures.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="clip-fixture" className="text-sm font-medium">Fixture</label>
              <select
                id="clip-fixture"
                name="fixture_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">None</option>
                {fixtures.map((f) => (
                  <option key={f.id} value={f.id}>
                    vs {f.opponent} ({formatDayMonth(f.fixture_date)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="clip-desc" className="text-sm font-medium">Description</label>
          <textarea
            id="clip-desc"
            name="description"
            rows={2}
            maxLength={500}
            placeholder="Optional notes about this clip…"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {state?.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add clip"}
        </Button>
      </form>
    </section>
  );
}
