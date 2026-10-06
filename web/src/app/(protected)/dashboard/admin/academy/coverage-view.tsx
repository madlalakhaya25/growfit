import { MILESTONE_CATEGORY_META } from "@/lib/development-categories";
import type { AgeGroupCoverage, CoverageWindow } from "@/lib/curriculum-coverage";

function sessionsLabel(n: number): string {
  return n === 1 ? "1 session" : `${n} sessions`;
}

/**
 * What was trained against the curriculum in the window, per age group. The
 * "Not touched" list comes first because it is the useful part. Everything is
 * computed from the links coaches made, never typed in.
 */
export function CoverageView({ groups, span }: Readonly<{ groups: AgeGroupCoverage[]; span: CoverageWindow }>) {
  if (groups.length === 0) {
    return <p className="rounded-md bg-muted px-3 py-2 text-sm">Write the curriculum first; coverage fills in as coaches tick what their sessions are about.</p>;
  }
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">Counted from {span.from} to {span.to}.</p>
      {groups.map((g) => (
        <section key={g.ageGroup} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold">{g.ageGroup}</h3>
            <span className="text-sm text-muted-foreground">{g.coveragePercent}% trained</span>
          </div>

          <div>
            <h4 className="text-sm font-medium">Not touched</h4>
            {g.notTouched.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every item has been trained.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {g.notTouched.map((i) => (
                  <li key={i.item.id}>{MILESTONE_CATEGORY_META[i.item.category].label}: {i.item.title}</li>
                ))}
              </ul>
            )}
          </div>

          {g.categories.map((c) => (
            <div key={c.category}>
              <h4 className="text-sm font-medium text-muted-foreground">{MILESTONE_CATEGORY_META[c.category].label}</h4>
              {c.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing written.</p>
              ) : (
                <ul className="space-y-0.5 text-sm">
                  {c.items.map((i) => (
                    <li key={i.item.id} className="flex justify-between gap-3">
                      <span>{i.item.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {i.sessions > 0 ? `${sessionsLabel(i.sessions)}, last ${i.lastTrained}` : "Not touched"}
                        {i.objectives > 0 ? ` · ${i.objectives} ${i.objectives === 1 ? "objective" : "objectives"}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
