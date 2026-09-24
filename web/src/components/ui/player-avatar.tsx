import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  /** Squad/shirt number, shown as a small badge on the avatar's corner. */
  jerseyNumber?: number | string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<PlayerAvatarProps["size"]>, { box: string; text: string; badge: string }> = {
  sm: { box: "size-9", text: "text-xs", badge: "text-[10px] -bottom-0.5 -right-0.5 size-4" },
  md: { box: "size-12", text: "text-sm", badge: "text-[11px] -bottom-1 -right-1 size-5" },
  lg: { box: "size-20", text: "text-xl", badge: "text-xs -bottom-1.5 -right-1.5 size-7" },
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
  const { box, text, badge } = SIZES[size];
  return (
    <div className={cn("relative shrink-0", box, className)}>
      <div
        className={cn(
          "shield-clip flex size-full items-center justify-center overflow-hidden bg-secondary text-secondary-foreground",
          text
        )}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            width={80}
            height={80}
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
            badge
          )}
          aria-hidden="true"
        >
          {jerseyNumber}
        </span>
      )}
    </div>
  );
}
