import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSharedPlay } from "@/app/actions/tactic-plays";
import { PlayViewer, type PlayData } from "@/components/tactics/play-viewer";
import { getConcept } from "@/lib/tactics";
import { Badge } from "@/components/ui/badge";

export default async function PlayerPlayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { play, error } = await getSharedPlay(token);

  if (error || !play) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Play not found</h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "This play isn't available. Ask your coach to share it again."}
        </p>
        <Link href="/dashboard/player/announcements" className="text-sm text-primary underline underline-offset-2">
          Back to announcements
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link href="/dashboard/player/announcements" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{play.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {play.team_name}{play.age_group ? ` · ${play.age_group}` : ""}
          </p>
        </div>
        {play.concept_ids?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {play.concept_ids.map((id) => (
              <Badge key={id} variant="brand">{getConcept(id)?.label ?? id}</Badge>
            ))}
          </div>
        )}
      </div>

      {play.notes && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{play.notes}</p>
        </div>
      )}

      {play.voice_url && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-semibold">Your coach explains this play</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={play.voice_url} className="w-full" />
        </div>
      )}

      <PlayViewer data={play.data as PlayData} />

      <p className="text-center text-xs text-muted-foreground">
        Yellow lines are runs and passes. Blue is a dribble. Watch where you should be at each moment.
      </p>
    </div>
  );
}
