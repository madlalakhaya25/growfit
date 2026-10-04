import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { formatDayMonth } from "@/lib/time";
import type { PlayerHomeworkRow } from "@/lib/homework-data";

/**
 * Tactics homework as evidence. For the player: the plays they've studied,
 * shown on the development page under the Tactical category (a count and a
 * list, no milestone logic). For a parent: what their child was sent and
 * whether it's done, read-only.
 */
export function HomeworkEvidence({ rows, audience }: Readonly<{ rows: PlayerHomeworkRow[]; audience: "player" | "parent" }>) {
  const done = rows.filter((r) => r.done);
  const shown = audience === "player" ? done : rows;
  if (shown.length === 0) return null;

  const heading = audience === "player" ? "Tactical homework" : "Tactics homework";
  const summary =
    audience === "player"
      ? `Tactical: you've studied ${done.length} ${done.length === 1 ? "play" : "plays"} at home.`
      : `${done.length} of ${rows.length} done.`;

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{heading}</h2>
      <Card className="space-y-2 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpenCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {summary}
        </p>
        <ListRowGroup>
          {shown.slice(0, 8).map((r) => (
            <ListRow
              key={r.id}
              href={audience === "player" ? `/dashboard/player/homework/${r.id}` : undefined}
              title={r.title}
              subtitle={r.done && r.completedAt ? `Done ${formatDayMonth(r.completedAt)}` : `Due ${formatDayMonth(r.dueDate)}`}
              trailing={r.done ? <Badge variant="success">{r.score}/{r.total}</Badge> : <Badge variant="neutral">Not yet</Badge>}
            />
          ))}
        </ListRowGroup>
        {audience === "player" && (
          <Link href="/dashboard/player/homework" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary">
            All homework
          </Link>
        )}
      </Card>
    </section>
  );
}
