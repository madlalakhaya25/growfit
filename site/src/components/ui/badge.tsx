import { cn } from "@/lib/utils";

const variants = {
  brand:   "bg-primary/10 text-primary border-transparent",
  neutral: "bg-muted text-muted-foreground border-transparent",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}

export function Badge({ children, variant = "brand", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
      variants[variant],
      className,
    )}>
      {children}
    </span>
  );
}
