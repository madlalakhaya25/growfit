import { TacticalConceptPanel } from "@/components/ai/tactical-concept-panel";

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

      <TacticalConceptPanel />
    </div>
  );
}
