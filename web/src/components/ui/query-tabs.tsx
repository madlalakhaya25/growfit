import Link from "next/link";
import { cn } from "@/lib/utils";
import { tabHref, type TabDef } from "@/lib/tabs";

interface QueryTabsProps {
  tabs: readonly TabDef[];
  active: string;
  /** The page's own path; each tab is this path plus `?tab=`. */
  basePath: string;
  className?: string;
}

/**
 * The same segmented control as SectionTabs, for tabs that are one page with
 * a `?tab=` value instead of separate routes. A server component: the page
 * reads `searchParams`, loads only the open tab's data and passes `active`.
 */
export function QueryTabs({ tabs, active, basePath, className }: Readonly<QueryTabsProps>) {
  return (
    <nav
      className={cn("flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-secondary p-0.5", className)}
      aria-label="Page sections"
    >
      {tabs.map(({ id, label }) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={tabHref(basePath, tabs, id)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-8 shrink-0 items-center rounded-[8px] px-4 text-sm transition-colors",
              isActive
                ? "bg-card font-semibold text-foreground shadow-[0_2px_6px_rgb(0_0_0/0.12)] dark:bg-[#636366]"
                : "font-medium text-foreground/80 hover:text-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
