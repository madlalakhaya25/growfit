import { MILESTONE_CATEGORIES, MILESTONE_CATEGORY_META } from "@/lib/development-categories";
import { growthLine } from "@/lib/term-review";
import type { BandMap } from "@/lib/term-review-data";

/**
 * What a family sees of a term review: how the child has grown since last
 * term, in a sentence per area. Never a number, never a comparison with other
 * children. Renders nothing until the coach has reviewed at least one area.
 */
export function TermGrowthCard({ termName, current, last }: Readonly<{ termName: string; current: BandMap; last: BandMap }>) {
  const lines = MILESTONE_CATEGORIES.flatMap((category) => {
    const band = current[category];
    if (!band) return [];
    return [{ category, text: growthLine(MILESTONE_CATEGORY_META[category].label, last[category], band) }];
  });
  if (lines.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Growth this term</h2>
      <p className="text-sm text-muted-foreground">{termName}, since the coach&apos;s last review.</p>
      <ul className="space-y-2 text-sm">
        {lines.map((l) => (
          <li key={l.category}>{l.text}</li>
        ))}
      </ul>
    </section>
  );
}
