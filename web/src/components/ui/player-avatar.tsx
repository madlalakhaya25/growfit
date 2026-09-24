import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  /** Squad/shirt number, shown as a small badge on the avatar's corner. */
  jerseyNumber?: number | string | null;
  /**
   * A named size (36/48/80px), or an exact pixel size for a caller that
   * doesn't fit the three variants — e.g. PlayerPassportCard, which is
   * shared across four surfaces (public passport, coach player detail,
   * player dashboard, parent child page) each sizing its header photo a
   * little differently. Prefer a named size where one fits.
   */
  size?: "sm" | "md" | "lg" | number;
  className?: string;
}

// `px` matches each box size's actual rendered pixels (size-9/12/20 = 36/48/80px
// in Tailwind's default spacing scale) so the fetched image is sized for what's
// actually displayed, not a constant 80px regardless of variant.
const SIZES: Record<NonNullable<PlayerAvatarProps["size"]>, { box: string; text: string; badge: string; px: number }> = {
  sm: { box: "size-9", text: "text-xs", badge: "text-[10px] -bottom-0.5 -right-0.5 size-4", px: 36 },
  md: { box: "size-12", text: "text-sm", badge: "text-[11px] -bottom-1 -right-1 size-5", px: 48 },
  lg: { box: "size-20", text: "text-xl", badge: "text-xs -bottom-1.5 -right-1.5 size-7", px: 80 },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * A player's headshot (or their initials, when no photo is on file) inside
 * the shield motif, with an optional jersey-number badge. Replaces plain
 * circular avatars — see docs/AI_FEATURES_AND_IA.md Part 4's "Matchday"
 * visual direction: the app already stores real headshots and barely used
 * them.
 */
export function PlayerAvatar({ name, photoUrl, jerseyNumber, size = "md", className }: PlayerAvatarProps) {
  const named = typeof size === "number" ? null : SIZES[size];
  const px = named?.px ?? (size as number);
  const boxClass = named?.box;
  const boxStyle = named ? undefined : { width: px, height: px };
  const textClass = named?.text ?? undefined;
  const textStyle = named ? undefined : { fontSize: Math.max(11, px * 0.32) };
  // Badge corner offset/size scale with the box for a custom pixel size,
  // matching the proportions the three named sizes already use.
  const badgeClass = named?.badge ?? "";
  const badgeStyle = named
    ? undefined
    : { width: px * 0.28, height: px * 0.28, right: -px * 0.02, bottom: -px * 0.02, fontSize: Math.max(9, px * 0.16) };

  return (
    <div className={cn("relative shrink-0", boxClass, className)} style={boxStyle}>
      <div
        className={cn(
          "shield-clip flex size-full items-center justify-center overflow-hidden bg-secondary text-secondary-foreground",
          textClass
        )}
        style={textStyle}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            width={px}
            height={px}
            className="size-full object-cover"
          />
        ) : (
          <span className="font-semibold">{initials(name)}</span>
        )}
      </div>
      {jerseyNumber != null && jerseyNumber !== "" && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground ring-2 ring-background",
            badgeClass
          )}
          style={badgeStyle}
          aria-hidden="true"
        >
          {jerseyNumber}
        </span>
      )}
    </div>
  );
}
