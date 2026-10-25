"use client";
import { OfflineBanner } from "@/components/offline-banner";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  Users,
  CalendarDays,
  UserCircle,
  LogOut,
  MessageSquare,
  Dumbbell,
  ShieldCheck,
  FileCheck,
  Loader2,
  Star,
  Trophy,
  BarChart3,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { TeamSwitcher } from "@/components/team-switcher";
import { QuickActionsSheet } from "@/components/quick-actions-sheet";
import { AskGrowfitSheet } from "@/components/ai/ask-growfit-sheet";
import { SectionTabs } from "@/components/ui/section-tabs";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/lib/use-sign-out";
import { getInitials } from "@/lib/player";
import { pickLongestActiveHref } from "@/lib/nav";
import { readCurrentTeamCookie, resolveCurrentTeamId } from "@/lib/current-team";
import type { UserRole } from "@/lib/types";
import type { FeatureKey } from "@/lib/features";

interface Tab {
  href: string;
  label: string;
  /** Hidden entirely when the academy has turned this feature off. Scoped
   * to the one tab it actually belongs to — not the whole section, which
   * used to take unrelated sibling tabs down with it (see `sections`
   * below and docs/BACKLOG.md 4.9). */
  feature?: FeatureKey;
}

interface NavSection {
  key: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Always at least one entry here — the first is the section's own link
   * and active-check target, and a second+ entry renders as `SectionTabs`
   * above the page content whenever that section is the active one. This
   * doesn't survive feature filtering though: `sections` below can and
   * does drop a tab, so nothing downstream may assume the tuple is intact. */
  tabs: [Tab, ...Tab[]];
}

// One tab bar per role, named for the academy's week rather than the app's
// features, and the same word on phone, desktop and page header. Every URL
// below already existed; this only changes how they're grouped and named.
// The user stories each tab serves are in the "Growfit navigation and
// structure proposal" doc (User stories tab); docs/AI_FEATURES_AND_IA.md
// Part 4 has the earlier reasoning. Settings sits under Me for every role,
// so nothing needs its own header button on a phone.
const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  admin: [
    { key: "club", label: "Club", Icon: ShieldCheck, tabs: [{ href: "/dashboard/admin", label: "Club" }] },
    {
      key: "people", label: "People", Icon: Users,
      tabs: [
        { href: "/dashboard/admin/players", label: "Players" },
        { href: "/dashboard/admin/teams", label: "Teams" },
      ],
    },
    {
      key: "paperwork", label: "Paperwork", Icon: FileCheck,
      tabs: [
        { href: "/dashboard/admin/players/documents", label: "Player forms" },
        { href: "/dashboard/admin/reports", label: "Reports" },
      ],
    },
    {
      key: "season", label: "Season", Icon: BarChart3,
      tabs: [
        { href: "/dashboard/admin/analytics", label: "Attendance" },
        { href: "/dashboard/admin/development", label: "Development" },
        { href: "/dashboard/admin/drills", label: "Drills" },
      ],
    },
    {
      key: "me", label: "Me", Icon: UserCircle,
      tabs: [
        { href: "/dashboard/admin/settings", label: "Settings" },
        { href: "/dashboard/admin/academy", label: "Academy" },
        { href: "/dashboard/admin/agent", label: "Automations", feature: "agent" },
      ],
    },
  ],
  coach: [
    { key: "today", label: "Today", Icon: Home, tabs: [{ href: "/dashboard/coach", label: "Today" }] },
    {
      key: "matches", label: "Matches", Icon: Trophy,
      tabs: [
        { href: "/dashboard/coach/fixtures", label: "Matches" },
        { href: "/dashboard/coach/tactics", label: "Plays", feature: "tactics" },
        { href: "/dashboard/coach/tactics/film", label: "Film", feature: "film" },
      ],
    },
    {
      key: "squad", label: "Squad", Icon: Users,
      tabs: [
        { href: "/dashboard/coach/squad", label: "Players" },
        { href: "/dashboard/coach/welfare", label: "Check-ins" },
        { href: "/dashboard/coach/squad/emergency", label: "Who to call" },
      ],
    },
    {
      key: "training", label: "Training", Icon: Dumbbell,
      tabs: [
        { href: "/dashboard/coach/training", label: "Sessions" },
        { href: "/dashboard/coach/training/drills", label: "Library", feature: "coach_extras" },
        { href: "/dashboard/coach/training/challenges", label: "Challenges", feature: "coach_extras" },
      ],
    },
    {
      key: "me", label: "Me", Icon: UserCircle,
      tabs: [
        { href: "/dashboard/coach/settings", label: "Settings" },
        { href: "/dashboard/coach/announcements", label: "Messages" },
        { href: "/dashboard/coach/learn", label: "Learn", feature: "coach_extras" },
        { href: "/dashboard/coach/assistant", label: "Assistant", feature: "assistant" },
        { href: "/dashboard/coach/agent", label: "Automations", feature: "agent" },
      ],
    },
  ],
  player: [
    { key: "home", label: "Home", Icon: Home, tabs: [{ href: "/dashboard/player", label: "Home" }] },
    {
      key: "calendar", label: "Calendar", Icon: CalendarDays,
      tabs: [
        { href: "/dashboard/player/training", label: "Training" },
        { href: "/dashboard/player/fixtures", label: "Matches" },
      ],
    },
    {
      key: "game", label: "My game", Icon: Star,
      tabs: [
        { href: "/dashboard/player/development", label: "Progress" },
        { href: "/dashboard/player/challenges", label: "Challenges" },
        { href: "/dashboard/player/records", label: "Records" },
      ],
    },
    {
      key: "coach", label: "Coach", Icon: MessageSquare,
      tabs: [
        { href: "/dashboard/player/homework", label: "Homework", feature: "tactics" },
        { href: "/dashboard/player/tactics", label: "Plays", feature: "tactics" },
        { href: "/dashboard/player/announcements", label: "Messages" },
      ],
    },
    { key: "me", label: "Me", Icon: UserCircle, tabs: [{ href: "/dashboard/player/settings", label: "Settings" }] },
  ],
  parent: [
    { key: "home", label: "Home", Icon: Home, tabs: [{ href: "/dashboard/parent", label: "Home" }] },
    { key: "matches", label: "Matches", Icon: CalendarDays, tabs: [{ href: "/dashboard/parent/fixtures", label: "Matches" }] },
    { key: "messages", label: "Messages", Icon: MessageSquare, tabs: [{ href: "/dashboard/parent/announcements", label: "Messages" }] },
    { key: "me", label: "Me", Icon: UserCircle, tabs: [{ href: "/dashboard/parent/settings", label: "Settings" }] },
  ],
};

interface Props {
  profile: { role: string; full_name: string; avatar_url: string | null };
  teams?: { id: string; name: string; age_group: string | null }[];
  features?: Partial<Record<FeatureKey, boolean>>;
  /** The academy's own name, shown in the header instead of the app name. */
  academyName?: string | null;
  children: React.ReactNode;
}

export function DashboardShell({ profile, teams = [], features, academyName, children }: Readonly<Props>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const role = profile.role as UserRole;
  const roleRoot = `/dashboard/${role}`;
  const allSections = NAV_BY_ROLE[role] ?? [];
  // Filter per-tab, not per-section -- switching off `film` should only
  // drop the Film tab, not take Fixtures down with it (same story for
  // `tactics` and Training/Development). A section that loses every tab
  // this way disappears entirely rather than rendering empty.
  const sections = allSections
    .map((s) => ({ ...s, tabs: s.tabs.filter((t) => !t.feature || features?.[t.feature] !== false) }))
    .filter((s) => s.tabs.length > 0);
  const { signOut: handleSignOut, isSigningOut } = useSignOut();

  // The single longest-matching href across every visible section's tabs,
  // not just the first section that has any match at all -- see
  // lib/nav.ts's own comment for the exact collision this fixes
  // (/dashboard/admin/players/documents used to highlight People, not
  // Compliance).
  const bestHref = pickLongestActiveHref(pathname, sections.flatMap((s) => s.tabs.map((t) => t.href)), roleRoot);
  const activeSection = sections.find((s) => s.tabs.some((t) => t.href === bestHref));

  // Reading the cookie here (rather than deferring to an effect) is safe:
  // this value only ever reaches the DOM through QuickActionsSheet's own
  // children, which don't render at all until the sheet is opened by a
  // click -- well after hydration, so there's nothing for the server and
  // client's first render to disagree about.
  const currentTeamId = resolveCurrentTeamId(teams, searchParams.get("team"), readCurrentTeamCookie());

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ── Sidebar (desktop) ─────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh w-64 flex-col border-r border-hairline bg-secondary/55 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo name={academyName} />
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {sections.map(({ key, label, Icon, tabs }) => {
            const active = activeSection?.key === key;
            return (
              <Link
                key={key}
                href={tabs[0].href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // A Mac sidebar: the selected row is filled with the
                  // accent, every other row shows its icon in the accent.
                  "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-hover"
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", !active && "text-primary")} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-hairline p-3 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground text-xs font-bold">
              {getInitials(profile.full_name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{profile.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-hairline bg-background/80 px-4 backdrop-blur-xl lg:px-8">
          <p className="min-w-0 truncate text-[17px] font-bold tracking-tight lg:hidden">
            {activeSection?.label ?? ""}
          </p>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            {role === "coach" && teams.length > 1 && <TeamSwitcher teams={teams} />}
            {role === "coach" && (features?.assistant !== false) && <AskGrowfitSheet />}
            {role === "coach" && <QuickActionsSheet defaultTeamId={currentTeamId ?? undefined} />}
            {/* Theme and sign-out live in Me, Settings on a phone: with them
                here the coach header measured 432 px on a 390 px screen,
                pushing Sign out off the edge. */}
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Section sub-navigation — only when the active section has more
            than one real destination (e.g. Matches, Plays and Film). */}
        {activeSection && activeSection.tabs.length > 1 && (
          <div className="px-4 pt-4 lg:px-8">
            <SectionTabs tabs={activeSection.tabs} />
          </div>
        )}

        {/* Bottom padding on phones keeps the last card clear of the tab bar. */}
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
          <OfflineBanner />
          {children}
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────── */}
        {/* A solid tab bar docked to the bottom edge. It used to float,
            frosted and translucent, and buttons and form fields showed
            through it mid-scroll, readable enough to look tappable but
            covered. Solid, with the page padded to clear it. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-card px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden"
          aria-label="Mobile navigation"
        >
          {sections.map(({ key, label, Icon, tabs }) => {
            const active = activeSection?.key === key;
            return (
              <Link
                key={key}
                href={tabs[0].href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className={cn("grid h-7 w-14 place-items-center rounded-full transition-colors", active && "bg-primary/10")}>
                  <Icon className="size-[22px]" aria-hidden="true" />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
