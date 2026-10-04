"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { pickLongestActiveHref } from "@/lib/nav";

export interface SectionTab {
  href: string;
  label: string;
}

interface SectionTabsProps {
  tabs: SectionTab[];
  className?: string;
}

/**
 * Sub-navigation inside one section of the app (e.g. Matchday's
 * Fixtures / Results / Film). Distinct from the top-level `NAV_BY_ROLE`
 * sections in `dashboard-shell.tsx` — this is one level down, and every
 * href is a real route, not a client-side tab switch, so the browser
 * back button and deep links both keep working.
 */
export function SectionTabs({ tabs, className }: SectionTabsProps) {
  const pathname = usePathname();
  // The longest-matching href, not every href that happens to match -- a
  // sibling tab that's a prefix of another (e.g. "Players" at
  // ".../squad" and "Emergency" at ".../squad/emergency") used to render
  // both active at once. See lib/nav.ts.
  const bestHref = pickLongestActiveHref(pathname, tabs.map((t) => t.href));

  return (
    <nav
      className={cn("flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-secondary p-1", className)}
      aria-label="Section navigation"
    >
      {tabs.map(({ href, label }) => {
        const active = href === bestHref;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-card text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
