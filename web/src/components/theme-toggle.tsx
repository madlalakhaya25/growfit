"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "dark", label: "Dark theme", Icon: Moon },
] as const;

/** Accessible 3-way theme switch (light / system / dark) as a radio group. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch: theme is unknown on the server.
  // Reads a browser API to sync into state -- window/navigator/
  // sessionStorage aren't available during SSR, so this legitimately
  // needs a real client-side pass to know the true value; there's no way
  // to compute it during the server render. This is React's own
  // documented purpose for an effect ("synchronize with an external
  // system"), applied to the browser environment itself rather than a
  // subscription -- the one-render cost is the price of not guessing at
  // a value the server genuinely cannot know.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/60 p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-colors",
              "text-muted-foreground hover:text-foreground",
              active && "bg-card text-foreground shadow-sm",
              value === "system" && "hidden lg:grid"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
