"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TermReviewCard } from "@/components/development/term-review-card";
import { MILESTONE_CATEGORIES, type MilestoneCategory } from "@/lib/development-categories";
import type { Band } from "@/lib/term-review";
import { clampIndex, nextIncomplete, reviewProgress } from "@/lib/squad-review";
import type { SquadReviewPlayer } from "@/lib/term-review-data";

interface Props {
  termId: string;
  termName: string;
  lastTermName: string | null;
  ageGroup: string | null;
  players: SquadReviewPlayer[];
}

type BandsByPlayer = Record<string, SquadReviewPlayer["current"]>;

const COUNT = MILESTONE_CATEGORIES.length;

/** One child at a time, with next and previous, until the squad's term review is done. */
export function SquadReview({ termId, termName, lastTermName, ageGroup, players }: Readonly<Props>) {
  const [index, setIndex] = useState(0);
  // The bands as the coach has them now. The card inside owns the picking;
  // this keeps the progress, and what a child shows when the coach comes back.
  const [bands, setBands] = useState<BandsByPlayer>(() => Object.fromEntries(players.map((p) => [p.id, p.current])));

  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">There are no active players on this team yet.</p>;
  }

  const player = players[clampIndex(index, players.length)];
  const doneByChild = players.map((p) => Object.keys(bands[p.id] ?? {}).length);
  const progress = reviewProgress(doneByChild, COUNT);
  const skipTo = nextIncomplete(doneByChild, COUNT, index);

  function saved(playerId: string, category: MilestoneCategory, band: Band | null) {
    setBands((all) => {
      const mine = { ...all[playerId] };
      if (band) mine[category] = band;
      else delete mine[category];
      return { ...all, [playerId]: mine };
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Player {index + 1} of {players.length}</p>
          <p className="text-sm text-muted-foreground">
            {progress.complete} of {players.length} finished
          </p>
        </div>
        <progress className="h-2 w-full" max={progress.total || 1} value={progress.done} aria-label="Review progress" />
      </div>

      <h2 className="text-xl font-bold">{player.name}</h2>

      <TermReviewCard
        key={player.id}
        playerId={player.id}
        termId={termId}
        termName={termName}
        ageGroup={ageGroup}
        initial={bands[player.id] ?? {}}
        last={player.last}
        lastTermName={lastTermName}
        onSaved={(category, band) => saved(player.id, category, band)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => setIndex((i) => clampIndex(i - 1, players.length))} disabled={index === 0}>
          <ChevronLeft className="size-4" aria-hidden="true" /> Previous
        </Button>
        {skipTo !== null && skipTo !== index && (
          <Button type="button" variant="ghost" onClick={() => setIndex(skipTo)}>
            <SkipForward className="size-4" aria-hidden="true" /> Next unfinished
          </Button>
        )}
        <Button type="button" onClick={() => setIndex((i) => clampIndex(i + 1, players.length))} disabled={index === players.length - 1}>
          Next <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
