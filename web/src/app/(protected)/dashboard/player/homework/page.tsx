import { BookOpenCheck } from "lucide-react";
import { listMyHomework, type MyHomeworkItem } from "@/app/actions/homework";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { formatWeekdayDayMonth, todayIso } from "@/lib/time";

function status(item: MyHomeworkItem, today: string) {
  if (item.done) return <Badge variant="success">{item.score}/{item.total}</Badge>;
  if (item.dueDate < today) return <Badge variant="neutral">Still open</Badge>;
  return <Badge variant="brand">To do</Badge>;
}

export default async function PlayerHomeworkPage() {
  const { available, items, error } = await listMyHomework();
  const today = todayIso();
  const todo = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <div className="space-y-6">
      <PageHeader title="Homework" description="Plays from your coach to watch at home, with a few quick questions." />
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!available && (
        <Card><EmptyState icon={BookOpenCheck} message="Homework isn't set up at your academy yet." /></Card>
      )}
      {available && items.length === 0 && !error && (
        <Card><EmptyState icon={BookOpenCheck} message="No homework right now. When your coach sends a play to study, it shows up here." /></Card>
      )}
      {todo.length > 0 && <HomeworkGroup heading="To do" items={todo} today={today} />}
      {done.length > 0 && <HomeworkGroup heading="Done" items={done} today={today} />}
    </div>
  );
}

function HomeworkGroup({ heading, items, today }: Readonly<{ heading: string; items: MyHomeworkItem[]; today: string }>) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</h2>
      <Card className="px-4 py-3">
        <ListRowGroup>
          {items.map((item) => (
            <ListRow
              key={item.id}
              href={`/dashboard/player/homework/${item.id}`}
              leading={
                <span className="grid size-10 place-items-center rounded-[10px] bg-primary/15 text-primary">
                  <BookOpenCheck className="size-5" aria-hidden="true" />
                </span>
              }
              title={item.title}
              subtitle={`${item.teamName} · due ${formatWeekdayDayMonth(item.dueDate)}`}
              trailing={status(item, today)}
            />
          ))}
        </ListRowGroup>
      </Card>
    </section>
  );
}
