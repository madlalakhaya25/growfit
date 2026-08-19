import Link from "next/link";
import { Play, Volume2, ChevronRight } from "lucide-react";
import { listSharedPlaysForMe } from "@/app/actions/tactic-plays";
import { getConcept } from "@/lib/tactics";
import { Badge } from "@/components/ui/badge";

export default async function PlayerTacticsPage() {
  const { plays, error } = await listSharedPlaysForMe();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Tactics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plays your coach has shared with the squad. Tap one to watch the movement.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && (plays ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium">No plays yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            When your coach shares a play, it appears here so you can watch it before
            training.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {(plays ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/player/tactics/${p.share_token}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Play className="size-5" aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0 space-y-1">
                  <span className="block font-semibold text-sm truncate">{p.name}</span>
                  {p.notes && (
                    <span className="block text-xs text-muted-foreground line-clamp-2">{p.notes}</span>
                  )}
                  <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {p.concept_ids.slice(0, 2).map((id) => (
                      <Badge key={id} variant="brand">{getConcept(id)?.label ?? id}</Badge>
                    ))}
                    {p.voice_url && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Volume2 className="size-3" aria-hidden="true" /> Voice note
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
