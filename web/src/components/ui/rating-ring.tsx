import { cn } from "@/lib/utils";

interface RatingRingProps {
  /** Overall rating 0–100. */
  value: number;
  size?: number;
  label?: string;
  className?: string;
}

function ratingColor(value: number) {
  if (value >= 80) return "var(--color-rating-high)";
  if (value >= 65) return "var(--color-rating-mid)";
  return "var(--color-rating-low)";
}

/** Circular overall-rating gauge (the signature "78 Overall" badge). */
export function RatingRing({
  value,
  size = 96,
  label = "Overall",
  className,
}: RatingRingProps) {
  // 0 is never a real overall (attributes are 1-99, match stars 1-5 x 20):
  // it means nobody has assessed this player yet. A child seeing "0 Overall"
  // on their own page reads it as a score, so say "not yet" instead.
  const assessed = value > 0;
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = Math.max(4, Math.round(size * 0.08));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const valueFontSize = Math.max(11, Math.round(size * 0.27));
  const labelFontSize = Math.max(7, Math.round(size * 0.115));

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
      {...(assessed
        ? { role: "meter", "aria-valuenow": clamped, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": `${label}: ${clamped} out of 100` }
        : { role: "img", "aria-label": `${label}: not assessed yet` })}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth={stroke}
        />
        {assessed && <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ratingColor(clamped)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />}
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        {assessed ? (
          <>
            <span className="font-bold tabular-nums" style={{ fontSize: valueFontSize }}>{clamped}</span>
            <span className="mt-0.5 uppercase tracking-wide text-muted-foreground" style={{ fontSize: labelFontSize }}>
              {label}
            </span>
          </>
        ) : (
          <span className="text-center text-muted-foreground" style={{ fontSize: labelFontSize }}>
            Not yet
            <br />
            rated
          </span>
        )}
      </div>
    </div>
  );
}
