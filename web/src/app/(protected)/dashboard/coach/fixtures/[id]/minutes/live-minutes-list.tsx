import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toMinutes } from "@/lib/playing-time";

interface LiveMinutesListProps {
  squad: string[];
  onPitch: string[];
  seconds: Record<string, number>;
  planned: Record<string, number>;
  names: Map<string, string>;
}

/** Everyone's minutes so far against the plan, players on the pitch first. */
export function LiveMinutesList({ squad, onPitch, seconds, planned, names }: Readonly<LiveMinutesListProps>) {
  const on = new Set(onPitch);
  const ordered = [...squad.filter((id) => on.has(id)), ...squad.filter((id) => !on.has(id))];
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">Minutes so far</h2>
      <Card className="px-4 py-2">
        <ul className="divide-y divide-border">
          {ordered.map((id) => (
            <li key={id} className="flex min-h-11 items-center gap-3 py-1.5 text-sm">
              <span
                className={cn("size-2.5 shrink-0 rounded-full", on.has(id) ? "bg-success" : "bg-muted-foreground/30")}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{names.get(id) ?? "Player"}</span>
              <span className="sr-only">{on.has(id) ? "on the pitch" : "on the bench"}</span>
              <span className="shrink-0 tabular-nums">
                {toMinutes(seconds[id] ?? 0)}&apos;
                <span className="text-muted-foreground"> / {planned[id] ?? 0}&apos;</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
