import { Target } from "lucide-react";
import { categoryMeta } from "@/lib/development-categories";
import type { PlayerSafeDevelopmentPlan } from "@/lib/development-plan-view";
import { formatDayMonthYear } from "@/lib/time";

/**
 * A coach-approved development plan, read-only, for a player or a parent.
 * Takes PlayerSafeDevelopmentPlan so a coach-only field cannot reach it by
 * type. Nothing here is editable and nothing calls a model.
 */
export function DevelopmentPlanReadonly({
  plan,
  approvedByName,
  audience,
  childName,
}: Readonly<{
  plan: PlayerSafeDevelopmentPlan;
  approvedByName: string | null;
  audience: "player" | "parent";
  childName?: string;
}>) {
  const who = audience === "parent" ? (childName ?? "your child") : "you";
  const reviewDate = plan.reviewDate ? formatDayMonthYear(plan.reviewDate) : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <Target className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          {plan.playerNote && <p className="text-sm text-foreground">{plan.playerNote}</p>}
          <p className="text-xs text-muted-foreground">
            {approvedByName ? `Approved by ${approvedByName}` : "Approved by your coach"}
            {reviewDate ? ` · Review on ${reviewDate}` : ""}
          </p>
        </div>
      </div>

      {plan.focusAreas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">What {who === "you" ? "you're" : `${who} is`} working on</h3>
          <ul className="space-y-2">
            {plan.focusAreas.map((f) => (
              <li key={`${f.category}-${f.area}`} className="text-sm">
                <span className="font-medium">
                  {categoryMeta(f.category)?.label ?? f.category}: {f.area}
                </span>
                {f.why && <span className="text-muted-foreground"> — {f.why}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.actions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">How</h3>
          <ul className="space-y-2">
            {plan.actions.map((a) => (
              <li key={a.what} className="text-sm">
                <span className="font-medium">{a.what}</span>
                <span className="text-muted-foreground"> ({a.timesPerWeek}x a week)</span>
                {a.how && <p className="text-muted-foreground">{a.how}</p>}
                {a.measure && <p className="text-xs text-muted-foreground">Measure: {a.measure}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
