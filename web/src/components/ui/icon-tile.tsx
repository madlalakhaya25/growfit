import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A white glyph on a small filled rounded square, the way iOS Settings
 * marks each row. Each tone is dark enough for the white glyph to clear
 * 3:1, so the icon still reads for low-vision users.
 */
const TONES = {
  red: "bg-primary",
  orange: "bg-[#b25000]",
  blue: "bg-[#0a63d6]",
  green: "bg-[#248a3d]",
  purple: "bg-[#8944ab]",
  teal: "bg-[#0e7c86]",
  grey: "bg-[#6c6c70]",
} as const;

export type IconTileTone = keyof typeof TONES;

export function IconTile({
  tone = "red",
  children,
  className,
}: Readonly<{ tone?: IconTileTone; children: React.ReactNode; className?: string }>) {
  return (
    <span
      className={cn(
        "grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white [&_svg]:size-4",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
