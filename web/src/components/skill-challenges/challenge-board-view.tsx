import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ChallengeBoard } from "@/lib/skill-challenges-data";
import { SKILL_CHALLENGES_NOT_YET } from "@/lib/skill-challenges-data";
import { ChallengeCard } from "./challenge-card";
import { TrophyCabinet } from "./trophy-cabinet";

/**
 * A child's challenges: their medals and streak, what the coach set, and the
 * rest of the catalogue to practise. Used by the player (logging their own
 * scores) and by a linked parent (logging on the child's behalf, `childId`).
 */
export function ChallengeBoardView({
  board,
  childId,
  childName,
}: Readonly<{ board: ChallengeBoard; childId?: string; childName?: string }>) {
  if (!board.available) return <EmptyState icon={Trophy} message={SKILL_CHALLENGES_NOT_YET} />;
  const who = childName ?? "you";
  return (
    <div className="space-y-6">
      <TrophyCabinet
        results={board.cabinet}
        streak={board.streak}
        heading={childName ? `${childName}'s medals` : "My medals"}
        emptyMessage={`No medals yet. Log a score below and see what ${who} can win.`}
      />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">From the coach</h2>
        {board.assigned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No challenges set right now. Try one of the practice ones below.</p>
        ) : (
          board.assigned.map((a) => (
            <ChallengeCard
              key={a.assignmentId}
              result={a.result}
              band={board.band}
              dueOn={a.dueOn}
              personal={a.personal}
              childId={childId}
            />
          ))
        )}
      </section>

      <details className="space-y-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold">
          More challenges to practise ({board.others.length})
        </summary>
        <div className="space-y-3 pt-2">
          {board.others.map((r) => (
            <ChallengeCard key={r.challenge.key} result={r} band={board.band} childId={childId} />
          ))}
        </div>
      </details>
    </div>
  );
}
