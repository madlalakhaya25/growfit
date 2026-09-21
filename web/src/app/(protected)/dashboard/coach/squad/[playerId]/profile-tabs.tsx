"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs for the coach's player page.
 *
 * That page rendered ten sections in one column: passport card, rating
 * history, a thirty-slider ability assessment, development milestones,
 * parent access, clips, two AI panels, emergency medical info, and then the
 * whole records block (registration, medical form, document hub). On a
 * phone, reaching Documents meant scrolling past both AI panels every time.
 *
 * Each section is rendered on the server and passed in as a slot, so
 * switching tabs is instant and nothing re-fetches. The passport card stays
 * outside the tabs — it is the answer to "who am I looking at", which is
 * needed on every tab.
 *
 * The active tab is deliberately *not* in the URL. A search param would
 * make every tab press a server round-trip for a page whose content is
 * already fully rendered, and a hash cannot be read during render without
 * a hydration mismatch (the server never sees it). Losing deep links to a
 * tab is the cheaper trade; the squad list keeps its filters in the URL,
 * where linking a filtered view actually earns the round-trip.
 */
export interface ProfileTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function ProfileTabs({ tabs }: { tabs: ProfileTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Player sections"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        // Kept mounted and hidden rather than unmounted: an open form on
        // another tab keeps whatever the coach had typed into it, and
        // switching back costs nothing.
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={tab.id !== active}
          className={cn("space-y-6", tab.id !== active && "hidden")}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
