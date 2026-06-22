"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
    >
      <Sun className="size-4 dark:hidden" aria-hidden="true" />
      <Moon className="size-4 hidden dark:block" aria-hidden="true" />
    </button>
  );
}
