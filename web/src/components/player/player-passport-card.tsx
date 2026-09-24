import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RatingRing } from "@/components/ui/rating-ring";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { cn } from "@/lib/utils";

/**
 * The passport-card header — photo (or initials), rating ring, name and
 * position — repeated across the public passport, the coach's player
 * detail page, the player's own dashboard, and the parent's child page
 * (docs/BACKLOG.md 2.7). They had already drifted once: the empty-state fix
 * from an earlier phase had to be applied to one of the four alone.
 *
 * Deliberately narrow: only the header chrome that was byte-for-byte
 * identical in content (just resized and, on the player dashboard, laid
 * out inline instead of stacked) is pulled out here. Each page still owns
 * its own badges and whatever comes after — an attribute summary, a
 * remove-photo button, a share QR code — passed in as children, since
 * those genuinely differ per surface rather than having drifted apart by
 * accident.
 */
export function PlayerPassportCard({
  photoUrl,
  fullName,
  overall,
  posLabel,
  descriptionSuffix,
  photoSize = 64,
  ringSize = 72,
  variant = "stacked",
  badges,
  className,
  barClassName,
  titleClassName,
  contentClassName,
  headerExtra,
  children,
}: {
  photoUrl: string | null;
  fullName: string;
  overall: number;
  posLabel: string;
  /** Appended after the position in the description line, e.g. an academy name. */
  descriptionSuffix?: string;
  photoSize?: number;
  ringSize?: number;
  /**
   * "stacked" (photo+ring on one row, name+description below — admin,
   * coach, parent, public passport) or "inline" (photo and name grouped on
   * the left, ring on the right, all in one row — the player's own
   * dashboard).
   */
  variant?: "stacked" | "inline";
  /** The badges row, e.g. position/age/foot/availability — fully custom per page. */
  badges?: React.ReactNode;
  className?: string;
  /** The brand-coloured top bar's height, e.g. "h-1.5" on the larger public passport card. */
  barClassName?: string;
  titleClassName?: string;
  contentClassName?: string;
  /** Rendered inside CardHeader, right after the description — e.g. the parent's remove-photo button, which sits above the badges rather than after them. */
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const photo = <PlayerAvatar name={fullName} photoUrl={photoUrl} size={photoSize} />;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className={cn("h-1 bg-brand", barClassName)} />
      {variant === "inline" ? (
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            {photo}
            <div>
              <CardTitle className={titleClassName}>{fullName}</CardTitle>
              <CardDescription>
                {posLabel}
                {descriptionSuffix ? ` · ${descriptionSuffix}` : ""}
              </CardDescription>
            </div>
          </div>
          <RatingRing value={overall} size={ringSize} />
        </CardHeader>
      ) : (
        <CardHeader>
          <div className="flex items-center justify-between">
            {photo}
            <RatingRing value={overall} size={ringSize} />
          </div>
          <CardTitle className={cn("mt-3", titleClassName)}>{fullName}</CardTitle>
          <CardDescription>
            {posLabel}
            {descriptionSuffix ? ` · ${descriptionSuffix}` : ""}
          </CardDescription>
          {headerExtra}
        </CardHeader>
      )}
      <CardContent className={cn("space-y-3", contentClassName)}>
        {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
        {children}
      </CardContent>
    </Card>
  );
}
