import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { formatDayMonth } from "@/lib/time";
import {
  formatScore,
  teamChallengeSummary,
  type AttemptRow,
  type SkillAgeBand,
  type SkillChallenge,
} from "@/lib/skill-challenges";
import { TrophyBadge } from "./trophy-badge";
import { RemoveAssignmentButton } from "./remove-assignment-button";

/**
 * One challenge the coach set: who has done it (best first, with medals) and
 * who hasn't yet. The "not yet" list is for a word at training; nothing is
 * sent to anyone.
 */
export function TeamChallengePanel({
  assignmentId,
  challenge,
  dueOn,
  band,
  players,
  forName,
  attempts,
}: Readonly<{
  assignmentId: string;
  challenge: SkillChallenge;
  dueOn: string;
  band: SkillAgeBand;
  players: { id: string; name: string }[];
  forName: string | null;
  attempts: AttemptRow[];
}>) {
  const { done, notYet } = teamChallengeSummary(challenge, band, players, attempts);
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-base font-semibold">{challenge.name}</h3>
          <p className="text-xs text-muted-foreground">
            {forName ?? "Whole team"} · try by {formatDayMonth(`${dueOn}T12:00:00+02:00`)} · {done.length} of {players.length} done
          </p>
        </div>
        <RemoveAssignmentButton assignmentId={assignmentId} name={challenge.name} />
      </div>

      {done.length > 0 && (
        <ListRowGroup>
          {done.map((row) => (
            <ListRow
              key={row.playerId}
              leading={<TrophyBadge trophy={row.result.trophy} size={24} compact />}
              title={row.name}
              subtitle={`${row.result.attempts} ${row.result.attempts === 1 ? "try" : "tries"}`}
              trailing={
                <span className="font-display text-base font-bold tabular-nums text-foreground">
                  {row.result.best === null ? "" : formatScore(challenge, row.result.best)}
                </span>
              }
            />
          ))}
        </ListRowGroup>
      )}

      {notYet.length > 0 && (
        <div className="space-y-2 rounded-[10px] bg-secondary/60 p-3">
          <p className="text-sm font-medium">Not tried yet</p>
          <p className="text-xs text-muted-foreground">A friendly word at training goes a long way. Nobody is messaged.</p>
          <ul className="flex flex-wrap gap-1.5">
            {notYet.map((p) => (
              <li key={p.playerId} className="rounded-full bg-card px-2.5 py-1 text-xs font-medium">
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
