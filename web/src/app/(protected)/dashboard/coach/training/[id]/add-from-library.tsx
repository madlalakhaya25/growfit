"use client";
import { useState, useTransition } from "react";
import { BookOpen, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addDrillFromLibrary } from "@/app/actions/drills";

interface LibraryDrill {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number | null;
  difficulty: string | null;
  video_url: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  warm_up: "Warm Up",
  technical: "Technical",
  tactical: "Tactical",
  physical: "Physical",
  small_sided: "Small Sided",
  cool_down: "Cool Down",
};

export function AddFromLibrary({
  sessionId,
  drills,
}: {
  sessionId: string;
  drills: LibraryDrill[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (drills.length === 0) return null;

  const filtered = drills.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      (d.description ?? "").toLowerCase().includes(query.toLowerCase())
  );

  function addDrill(drillId: string) {
    setError(null);
    startTransition(async () => {
      const result = await addDrillFromLibrary(sessionId, drillId);
      if (result?.error) { setError(result.error); toast.error(result.error); }
      else toast.success("Drill added.");
    });
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="gap-2"
      >
        <BookOpen className="size-4" aria-hidden="true" />
        {open ? "Hide library" : "Add from library"}
      </Button>

      {open && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search drills…"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <p role="alert" className="mx-4 mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No matching drills.</p>
            ) : (
              filtered.map((drill) => (
                <div key={drill.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{drill.name}</p>
                      <span className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[drill.category] ?? drill.category}
                      </span>
                      {drill.duration_minutes && (
                        <span className="text-xs text-muted-foreground">{drill.duration_minutes} min</span>
                      )}
                    </div>
                    {drill.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{drill.description}</p>
                    )}
                    {drill.video_url && (
                      <a
                        href={drill.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <PlayCircle className="size-3" aria-hidden="true" />
                        Video
                      </a>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => addDrill(drill.id)}
                    className="shrink-0 text-xs"
                  >
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
