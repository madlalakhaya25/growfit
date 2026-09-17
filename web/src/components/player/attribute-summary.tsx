import { StatBar } from "@/components/ui/stat-bar";
import {
  ATTR_CATEGORIES,
  ATTR_META,
  CATEGORY_LABELS,
  getPositionAttrKeys,
  type AttrKey,
} from "@/lib/attributes";

interface Props {
  /** Averaged across assessing coaches; attributes nobody rated are absent. */
  attrs: Partial<Record<AttrKey, number | null>> | null | undefined;
  position: string | null | undefined;
  /** Group the bars under their corner headings, as the public passport does. */
  grouped?: boolean;
  className?: string;
}

/**
 * The attribute snapshot, shown on all five player surfaces — coach squad,
 * player dashboard, parent, admin and the public passport.
 *
 * Each of those hand-rolled the same "narrow to this position's attributes,
 * drop the ones nobody rated, render a StatBar each" block, which is how the
 * five drifted apart in the first place: two of them were still showing a
 * fixed six attributes long after the model moved on.
 *
 * Renders nothing when there is no assessment to show, so callers do not need
 * to guard.
 */
export function AttributeSummary({ attrs, position, grouped = false, className }: Props) {
  const keys = getPositionAttrKeys(position).filter(
    (key) => typeof attrs?.[key] === "number"
  );

  if (keys.length === 0) return null;

  if (!grouped) {
    return (
      <div className={className}>
        {keys.map((key) => (
          <StatBar key={key} label={ATTR_META[key].label} value={attrs![key]!} />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {ATTR_CATEGORIES.map((category) => {
        const inCategory = keys.filter((key) => ATTR_META[key].category === category);
        if (inCategory.length === 0) return null;
        return (
          <div key={category} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </p>
            {inCategory.map((key) => (
              <StatBar key={key} label={ATTR_META[key].label} value={attrs![key]!} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
