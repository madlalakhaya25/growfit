import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[color,background-color,border-color,opacity,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        brand: "bg-brand text-brand-foreground hover:opacity-90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:bg-secondary/60",
        ghost: "bg-transparent text-foreground hover:bg-secondary/60",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
        /**
         * `outline`/`ghost` key off `--color-foreground`/`--color-border` —
         * tokens tuned for sitting on the page's own background. `--color-ink`
         * (the coach fixture-detail scoreline header, FixtureTicket) is now
         * *aliased* to `--color-foreground` specifically so it inverts against
         * the page — dark band on the light page, light band on the dark page
         * — so `outline`'s page-tuned colours are exactly backwards on it in
         * every theme. This variant keys off `--color-ink-foreground` instead
         * (aliased the other way, to `--color-background`), which is always
         * the correct contrast colour for whichever way `--color-ink` is
         * currently inverted. Use it for any button placed directly on a
         * `bg-ink` surface.
         */
        onInk:
          "border border-ink-foreground/25 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-7 text-base",
        icon: "size-11",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
