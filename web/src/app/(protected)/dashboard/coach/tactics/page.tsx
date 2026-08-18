import Link from "next/link";
import { LayoutGrid, ChevronRight } from "lucide-react";
import { TacticalConceptPanel } from "@/components/ai/tactical-concept-panel";
import { PositionalRolePanel } from "@/components/ai/positional-role-panel";

export default function CoachTacticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tactics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pick a tactical concept and get an age-appropriate explanation, reference
          videos, and a ready-to-run training session — all grounded in the LTPD phase
          for your age group.
        </p>
      </div>

      <Link
        href="/dashboard/coach/tactics/board"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <LayoutGrid className="size-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm">Open the Tactical Board</span>
          <span className="block text-xs text-muted-foreground">
            Set up your squad in a formation and draw runs &amp; passing lines.
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
      </Link>

      <TacticalConceptPanel />
      <PositionalRolePanel />
    </div>
  );
}
