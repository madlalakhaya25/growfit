import { cn } from "@/lib/utils";
import { TROPHY_LABELS, type Trophy } from "@/lib/skill-challenges";

/**
 * A medal drawn in the app's own tokens: gold uses the Leadership gold, bronze
 * the Tactical copper, silver the muted grey. Colour is never the only signal:
 * the medal carries 1, 2 or 3 stars and (unless `compact`) its name.
 */
const TONE: Record<Trophy, string> = {
  gold: "text-dev-leadership",
  silver: "text-muted-foreground",
  bronze: "text-dev-tactical",
};

const STARS: Record<Trophy, number> = { bronze: 1, silver: 2, gold: 3 };

const STAR_PATH = "M0,-3.2 L0.94,-1.3 L3.04,-0.99 L1.52,0.49 L1.88,2.59 L0,1.6 L-1.88,2.59 L-1.52,0.49 L-3.04,-0.99 L-0.94,-1.3 Z";

const STAR_X: Record<number, number[]> = { 1: [20], 2: [16, 24], 3: [13.5, 20, 26.5] };

export function TrophyBadge({
  trophy,
  size = 40,
  compact = false,
  className,
}: Readonly<{ trophy: Trophy | null; size?: number; compact?: boolean; className?: string }>) {
  if (!trophy) {
    return (
      <span className={cn("inline-flex flex-col items-center gap-0.5 text-muted-foreground/40", className)}>
        <svg width={size} height={size * 1.2} viewBox="0 0 40 48" aria-hidden="true">
          <circle cx="20" cy="28" r="15" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        {!compact && <span className="text-xs font-medium">No medal yet</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col items-center gap-0.5", TONE[trophy], className)}>
      <svg width={size} height={size * 1.2} viewBox="0 0 40 48" role="img" aria-label={`${TROPHY_LABELS[trophy]} medal`}>
        {/* Ribbon */}
        <path d="M11 0 H18 L23 14 H16 Z" fill="currentColor" opacity="0.55" />
        <path d="M29 0 H22 L17 14 H24 Z" fill="currentColor" opacity="0.8" />
        {/* Medal */}
        <circle cx="20" cy="28" r="15" fill="currentColor" />
        <circle cx="20" cy="28" r="11.5" fill="none" stroke="var(--color-card)" strokeWidth="1.5" opacity="0.7" />
        {STAR_X[STARS[trophy]].map((x) => (
          <path key={x} d={STAR_PATH} transform={`translate(${x} 28)`} fill="var(--color-card)" />
        ))}
      </svg>
      {!compact && <span className="text-xs font-semibold">{TROPHY_LABELS[trophy]}</span>}
    </span>
  );
}
