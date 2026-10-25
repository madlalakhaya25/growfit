import { cn } from "@/lib/utils";
import { PlayerAvatar } from "@/components/ui/player-avatar";

const KITS = ["fill-kit-1", "fill-kit-2", "fill-kit-3", "fill-kit-4", "fill-kit-5"] as const;

/** Same name, same shirt colour, on every screen and every visit. */
export function kitFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return KITS[h % KITS.length];
}

/**
 * A player's photo if the club has one, otherwise a shirt with their first
 * initial on it. A shirt reads as "one of ours" where two grey initials read
 * as a contact list, and it shows no face, so it is safe on any screen.
 */
export function KitAvatar({
  name,
  photoUrl,
  className,
}: Readonly<{ name: string; photoUrl?: string | null; className?: string }>) {
  if (photoUrl) return <PlayerAvatar name={name} photoUrl={photoUrl} size={44} className={className} />;
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={cn("relative grid size-11 shrink-0 place-items-center", className)} aria-hidden="true">
      <svg viewBox="0 0 40 40" className="absolute inset-0 size-full">
        <path
          d="M13 7 L7 10 L2 16 L7 20 L10 18 L10 36 L30 36 L30 18 L33 20 L38 16 L33 10 L27 7 Q20 12 13 7 Z"
          className={cn(kitFor(name), "stroke-black/15")}
          strokeWidth={1}
        />
      </svg>
      <span className="relative pt-1.5 font-display text-lg font-bold leading-none text-kit-ink">{initial}</span>
    </span>
  );
}
