import Link from "next/link";
import { ArrowLeft, BookOpenCheck } from "lucide-react";
import { listCoachHomework, type CoachHomework } from "@/app/actions/homework";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { DeleteHomeworkButton } from "@/components/homework/delete-homework-button";
import { formatWeekdayDayMonth } from "@/lib/time";
import type { PlayerProgress } from "@/lib/homework";

function progressBadge(p: PlayerProgress) {
  if (!p.done) return <Badge variant="neutral">Not yet</Badge>;
  if (p.struggled) return <Badge variant="warning">{p.score}/{p.total} · have a chat</Badge>;
  return <Badge variant="success">{p.score}/{p.total}</Badge>;
}

export default async function CoachHomeworkPage() {
  const { available, items, error } = await listCoachHomework();
  return (
    <div className="space-y-6">
      <Link href="/dashboard/coach/tactics" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Tactics
      </Link>
      <PageHeader
        title="Tactics homework"
        description="Plays you've sent home with a quick quiz. Send one from a saved play on the Tactical Board."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!available && (
        <Card><EmptyState icon={BookOpenCheck} message="Homework needs database update 063. Ask your admin to run it." /></Card>
      )}
      {available && items.length === 0 && !error && (
        <Card>
          <EmptyState
            icon={BookOpenCheck}
            message="No homework yet. Open a saved play on the board and tap Send as homework."
            action={<Link href="/dashboard/coach/tactics/board" className="text-sm font-semibold text-primary">Open the Tactical Board</Link>}
          />
        </Card>
      )}
      {items.map((hw) => <HomeworkCard key={hw.id} hw={hw} />)}
    </div>
  );
}

function HomeworkCard({ hw }: Readonly<{ hw: CoachHomework }>) {
  const { summary } = hw;
  const missed = hw.questions
    .map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt, missed: summary.missedPerQuestion[i] ?? 0 }))
    .filter((q) => q.missed > 0);
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{hw.title}</h2>
          <p className="text-sm text-muted-foreground">
            {hw.teamName} · due {formatWeekdayDayMonth(hw.dueDate)} · {summary.doneCount} of {summary.players.length} done
            {hw.hasPlay ? "" : " · play deleted"}
          </p>
        </div>
        <DeleteHomeworkButton id={hw.id} title={hw.title} />
      </div>
      {missed.length > 0 && (
        <Card className="space-y-1 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tricky questions</p>
          <ul className="space-y-1">
            {missed.map((q) => (
              <li key={q.id} className="text-sm">
                {q.prompt} <span className="text-muted-foreground">· {q.missed} got it wrong</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="px-4 py-3">
        {summary.players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players on this team yet.</p>
        ) : (
          <ListRowGroup>
            {summary.players.map((p) => (
              <ListRow key={p.playerId} title={p.name} trailing={progressBadge(p)} />
            ))}
          </ListRowGroup>
        )}
      </Card>
    </section>
  );
}
