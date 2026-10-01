import { cn } from "@/lib/utils";

/**
 * The one loading indicator. Replaces the hand-rolled
 * `animate-spin border-2 border-primary border-t-transparent` span repeated
 * across the AI panels. Announced to assistive tech; the animation is already
 * switched off globally under prefers-reduced-motion.
 */
export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  /** Spoken name; the visible text usually sits beside it. */
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-primary border-t-transparent",
        className
      )}
    />
  );
}
