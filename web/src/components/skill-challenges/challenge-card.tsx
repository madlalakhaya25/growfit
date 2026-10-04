import { formatDayMonth } from "@/lib/time";
import {
  TROPHIES,
  TROPHY_LABELS,
  TARGETS_NOTE,
  formatScore,
  nextTarget,
  type ChallengeResult,
  type SkillAgeBand,
} from "@/lib/skill-challenges";
import { TrophyBadge } from "./trophy-badge";
import { ScoreLogger } from "./score-logger";

function NextLine({ result, band }: Readonly<{ result: ChallengeResult; band: SkillAgeBand }>) {
  const next = nextTarget(result.challenge, band, result.best);
  if (!next) return <p className="text-sm font-medium text-dev-leadership">Gold won. Can you beat your best?</p>;
  const lower = result.challenge.better === "lower";
  return (
    <p className="text-sm text-muted-foreground">
      {lower ? "Finish in " : "Reach "}
      <span className="font-semibold text-foreground">{formatScore(result.challenge, next.target)}</span>
      {lower ? " or less" : ""} for {TROPHY_LABELS[next.trophy].toLowerCase()}.
    </p>
  );
}

/** One challenge: medal, personal best, how to do it, targets, and the score box. */
export function ChallengeCard({
  result,
  band,
  dueOn,
  personal,
  childId,
}: Readonly<{ result: ChallengeResult; band: SkillAgeBand; dueOn?: string; personal?: boolean; childId?: string }>) {
  const { challenge, best } = result;
  const targets = challenge.targets[band];
  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-base font-semibold leading-snug">{challenge.name}</h3>
          <p className="text-xs text-muted-foreground">
            {dueOn ? `Try by ${formatDayMonth(`${dueOn}T12:00:00+02:00`)}` : "Practice any time"}
            {personal ? " · Just for you" : ""}
          </p>
          <p className="text-sm">
            Best:{" "}
            <span className="font-display text-lg font-bold tabular-nums">
              {best === null ? "not tried yet" : formatScore(challenge, best)}
            </span>
          </p>
          <NextLine result={result} band={band} />
        </div>
        <TrophyBadge trophy={result.trophy} />
      </div>

      <details className="group rounded-[10px] bg-secondary/60 px-3 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">How to do it</summary>
        <ol className="list-decimal space-y-1 pb-2 pl-5 text-sm">
          {challenge.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Score: {challenge.measure}.</p>
      </details>

      <div className="space-y-1">
        <ul className="grid grid-cols-3 gap-2 text-center">
          {TROPHIES.map((t) => (
            <li key={t} className="flex flex-col items-center rounded-[10px] bg-secondary/60 py-2">
              <TrophyBadge trophy={t} size={22} compact />
              <span className="text-sm font-semibold tabular-nums">{formatScore(challenge, targets[t])}</span>
              <span className="text-[11px] text-muted-foreground">{TROPHY_LABELS[t]}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">{TARGETS_NOTE}</p>
      </div>

      <ScoreLogger
        challengeKey={challenge.key}
        challengeName={challenge.name}
        unit={challenge.unit}
        start={best ?? targets.bronze}
        childId={childId}
      />
    </article>
  );
}
