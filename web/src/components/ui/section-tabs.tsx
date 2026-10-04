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
      // An iOS segmented control: a grey track, the current page lifted
      // out of it as a white segment.
      className={cn("flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-secondary p-0.5", className)}
      aria-label="Section navigation"
    >
      {tabs.map(({ href, label }) => {
        const active = href === bestHref;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-8 shrink-0 items-center rounded-[8px] px-4 text-sm transition-colors",
              active
                ? "bg-card font-semibold text-foreground shadow-[0_2px_6px_rgb(0_0_0/0.12)] dark:bg-[#636366]"
                : "font-medium text-foreground/80 hover:text-foreground"
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
