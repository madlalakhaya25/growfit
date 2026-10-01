import { cn } from "@/lib/utils";

interface StatBarProps {
  label: string;
  /** 0–100 attribute value (FIFA-style). */
  value: number;
  /**
   * Fill colour override (any CSS colour, e.g. a `--color-dev-*` var). Omitted,
   * the fill is banded by the value itself (high / mid / low) -- right for an
   * attribute, meaningless for a category, which needs its own identity colour
   * rather than one chosen by how complete it is.
   */
  color?: string;
  className?: string;
}

/** Colour the fill by performance band — high (lime) / mid (amber) / low (red). */
function ratingColor(value: number) {
  if (value >= 80) return "var(--color-rating-high)";
  if (value >= 65) return "var(--color-rating-mid)";
  return "var(--color-rating-low)";
}

/** FIFA-card style attribute bar: label, animated fill, numeric value. */
export function StatBar({ label, value, color, className }: StatBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="w-24 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
        role="meter"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${clamped} out of 100`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: color ?? ratingColor(clamped) }}
        />
      </div>
      <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums">
        {clamped}
      </span>
    </div>
  );
}
