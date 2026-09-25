import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        brand: "border-transparent bg-brand/15 text-primary",
        neutral: "border-border bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        danger: "border-transparent bg-destructive/15 text-destructive",
        outline: "border-border bg-transparent text-foreground",
        /**
         * `success`/`warning`/`danger` pair a translucent tint with that
         * status's own solid text colour — which, like `outline`
         * (button.tsx has the fuller version of this note), is tuned for
         * sitting on the page's own background. On `--color-ink` (which
         * inverts against the page) that pairing goes low-contrast exactly
         * opposite the app's theme: e.g. dark mode's light-tuned red
         * lands on `--color-ink`'s now-*light* band. Rather than add an
         * `-on-ink` pair for every status colour, this variant keeps a
         * single ink-safe pill (the same formula as Button's `onInk`) and
         * expects the caller to pair it with a small solid-colour dot
         * (opaque, so it doesn't need theme-aware contrast the way text
         * does) for the actual status colour — see its use in the coach
         * fixture-detail header.
         */
        onInk: "border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
