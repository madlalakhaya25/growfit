import { DrillDiagramView } from "@/components/tactics/drill-diagram";
import type { DrillDetails } from "@/lib/drill-details";

/** A drill's saved plan: the diagram first, then the sections a coach reads at the pitch. */
export function DrillDetailsView({ details, large = false }: Readonly<{ details: DrillDetails; large?: boolean }>) {
  const body = large ? "text-base" : "text-sm";
  const sections: [string, string][] = [
    ["Setup", details.setup],
    ["Instructions", details.instructions],
    ["Coaching points", details.coachingPoints],
  ];
  return (
    <div className="space-y-3">
      {details.diagram && (
        <div className="max-w-xs">
          <DrillDiagramView diagram={details.diagram} />
        </div>
      )}
      {(details.durationMinutes > 0 || details.ltpdFocus || details.fourCorner) && (
        <p className="flex flex-wrap gap-1.5 text-xs">
          {details.durationMinutes > 0 && <span className="rounded-full bg-muted px-2 py-0.5">{details.durationMinutes} min</span>}
          {details.fourCorner && <span className="rounded-full bg-muted px-2 py-0.5">{details.fourCorner}</span>}
          {details.ltpdFocus && <span className="rounded-full bg-muted px-2 py-0.5">{details.ltpdFocus}</span>}
        </p>
      )}
      {sections.filter(([, v]) => v).map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`${body} whitespace-pre-wrap`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
