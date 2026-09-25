"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  UserCircle,
  LogOut,
  ChevronRight,
  Megaphone,
  Dumbbell,
  Settings,
  Building2,
  Lightbulb,
  Loader2,
  FileText,
  BarChart3,
  MoreHorizontal,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { TeamSwitcher } from "@/components/team-switcher";
import { QuickActionsSheet } from "@/components/quick-actions-sheet";
import { AskGrowfitSheet } from "@/components/ai/ask-growfit-sheet";
import { SectionTabs } from "@/components/ui/section-tabs";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { isActiveHref } from "@/lib/nav";
import { readCurrentTeamCookie, resolveCurrentTeamId } from "@/lib/current-team";
import type { UserRole } from "@/lib/types";
import type { FeatureKey } from "@/lib/features";

interface Tab {
  href: string;
  label: string;
}

interface NavSection {
  key: string;
  label: string;
  mobileLabel?: string;
  mobileHide?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  /** Always at least one entry — the first is the section's own link and
   * active-check target. A second+ entry renders as `SectionTabs` above
   * the page content whenever that section is the active one. */
  tabs: [Tab, ...Tab[]];
  /** Hidden entirely when the academy has turned this feature off. */
  feature?: FeatureKey;
}

// Grouped from the previous flat NAV_BY_ROLE lists (6 items for coach, with
// several real pages — the assistant, welfare, two admin pages — reachable
// by no nav item at all) into a handful of sections per role, each with
// its own sub-navigation. Every URL below already existed; this only
// changes how they're grouped and reached. See
// docs/AI_FEATURES_AND_IA.md Part 4 for the full reasoning.
const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  admin: [
    { key: "overview", label: "Overview", Icon: LayoutDashboard, tabs: [{ href: "/dashboard/admin", label: "Overview" }] },
    {
      key: "people", label: "People", Icon: Users,
      tabs: [
        { href: "/dashboard/admin/players", label: "Players" },
        { href: "/dashboard/admin/teams", label: "Teams" },
      ],
    },
    {
      key: "compliance", label: "Compliance", Icon: FileText,
      tabs: [
        { href: "/dashboard/admin/players/documents", label: "Documents" },
        { href: "/dashboard/admin/reports", label: "Reports" },
      ],
    },
    {
      key: "insights", label: "Insights", Icon: BarChart3, mobileHide: true,
      tabs: [
        { href: "/dashboard/admin/analytics", label: "Analytics" },
        { href: "/dashboard/admin/development", label: "Development" },
      ],
    },
    { key: "academy", label: "Academy", Icon: Building2, mobileHide: true, tabs: [{ href: "/dashboard/admin/academy", label: "Academy" }] },
  ],
  coach: [
    { key: "today", label: "Overview", mobileLabel: "Home", Icon: LayoutDashboard, tabs: [{ href: "/dashboard/coach", label: "Today" }] },
    {
      key: "matchday", label: "Matchday", Icon: Calendar,
      tabs: [
        { href: "/dashboard/coach/fixtures", label: "Fixtures" },
        { href: "/dashboard/coach/tactics/film", label: "Film" },
      ],
      feature: "film",
    },
    {
      key: "squad", label: "Squad", Icon: Users,
      tabs: [
        { href: "/dashboard/coach/squad", label: "Players" },
        { href: "/dashboard/coach/welfare", label: "Welfare" },
        { href: "/dashboard/coach/squad/emergency", label: "Emergency" },
      ],
    },
    {
      key: "develop", label: "Develop", Icon: Dumbbell,
      tabs: [
        { href: "/dashboard/coach/training", label: "Training" },
        { href: "/dashboard/coach/tactics", label: "Tactics" },
      ],
      feature: "tactics",
    },
    {
      key: "more", label: "More", Icon: MoreHorizontal,
      tabs: [
        { href: "/dashboard/coach/announcements", label: "Posts" },
        { href: "/dashboard/coach/assistant", label: "Assistant" },
        { href: "/dashboard/coach/settings", label: "Settings" },
      ],
    },
  ],
  player: [
    { key: "passport", label: "My Passport", mobileLabel: "Passport", Icon: UserCircle, tabs: [{ href: "/dashboard/player", label: "Passport" }] },
    {
      key: "schedule", label: "Schedule", Icon: Calendar,
      tabs: [
        { href: "/dashboard/player/fixtures", label: "Matches" },
        { href: "/dashboard/player/training", label: "Training" },
      ],
    },
    {
      key: "learn", label: "Learn", Icon: Lightbulb,
      tabs: [
        { href: "/dashboard/player/tactics", label: "Plays" },
        { href: "/dashboard/player/development", label: "Development" },
      ],
      feature: "tactics",
    },
    { key: "posts", label: "Announcements", mobileLabel: "Posts", Icon: Megaphone, tabs: [{ href: "/dashboard/player/announcements", label: "Posts" }] },
  ],
  parent: [
    { key: "children", label: "My Children", mobileLabel: "Children", Icon: UserCircle, tabs: [{ href: "/dashboard/parent", label: "My Children" }] },
    { key: "fixtures", label: "Fixtures", Icon: Calendar, tabs: [{ href: "/dashboard/parent/fixtures", label: "Fixtures" }] },
    { key: "posts", label: "Announcements", mobileLabel: "Posts", Icon: Megaphone, tabs: [{ href: "/dashboard/parent/announcements", label: "Posts" }] },
  ],
};


interface Props {
  profile: { role: string; full_name: string; avatar_url: string | null };
  teams?: { id: string; name: string; age_group: string | null }[];
  features?: Partial<Record<FeatureKey, boolean>>;
  children: React.ReactNode;
}

export function DashboardShell({ profile, teams = [], features, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearAuth = useAuthStore((s) => s.clear);
  const supabase = createClient();

  const role = profile.role as UserRole;
  const roleRoot = `/dashboard/${role}`;
  const allSections = NAV_BY_ROLE[role] ?? [];
  const sections = allSections.filter((s) => !s.feature || features?.[s.feature] !== false);
  const [isSigningOut, startSignOut] = useTransition();

  const activeSection = sections.find((s) =>
    s.tabs.some((t) => isActiveHref(pathname, t.href, roleRoot))
  );

  // Reading the cookie here (rather than deferring to an effect) is safe:
  // this value only ever reaches the DOM through QuickActionsSheet's own
  // children, which don't render at all until the sheet is opened by a
  // click -- well after hydration, so there's nothing for the server and
  // client's first render to disagree about.
  const currentTeamId = resolveCurrentTeamId(teams, searchParams.get("team"), readCurrentTeamCookie());

  function handleSignOut() {
    startSignOut(async () => {
      await supabase.auth.signOut();
      clearAuth();
      router.push("/auth/login");
    });
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ── Sidebar (desktop) ─────────────────────────────────── */}
      <aside className="hidden w-60 flex-col border-r border-border bg-background lg:flex">
        <div className="flex h-16 items-center px-5 border-b border-border">
          <Logo />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {sections.map(({ key, label, Icon, tabs }) => {
            const active = activeSection?.key === key;
            return (
              <Link
                key={key}
                href={tabs[0].href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {label}
                {active && <ChevronRight className="ml-auto size-3 text-primary" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground text-xs font-bold">
              {profile.full_name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{profile.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{profile.role}</p>
            </div>
          </div>
          <Link
            href={`${roleRoot}/settings`}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              pathname.startsWith(`${roleRoot}/settings`) && "bg-primary/10 text-primary"
            )}
          >
            <Settings className="size-4" aria-hidden="true" />
            Settings
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleSignOut} disabled={isSigningOut}>
            {isSigningOut ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between gap-2 border-b border-border px-4 lg:px-6">
          <p className="min-w-0 truncate text-base font-semibold lg:hidden">
            {activeSection?.label ?? ""}
          </p>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            {role === "coach" && teams.length > 1 && <TeamSwitcher teams={teams} />}
            {role === "coach" && (features?.assistant !== false) && <AskGrowfitSheet />}
            {role === "coach" && <QuickActionsSheet defaultTeamId={currentTeamId ?? undefined} />}
            <ThemeToggle />
            <Link
              href={`${roleRoot}/settings`}
              className="lg:hidden grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Settings"
            >
              <Settings className="size-4" aria-hidden="true" />
            </Link>
            <Button variant="ghost" size="sm" className="px-2 lg:hidden" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Section sub-navigation — only when the active section has more
            than one real destination (e.g. Matchday's Fixtures/Film). */}
        {activeSection && activeSection.tabs.length > 1 && (
          <div className="border-b border-border px-4 lg:px-6">
            <SectionTabs tabs={activeSection.tabs} className="border-b-0" />
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          {children}
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────── */}
        <nav className="flex border-t border-border bg-background lg:hidden" aria-label="Mobile navigation">
          {sections.filter((s) => !s.mobileHide).map(({ key, label, mobileLabel, Icon, tabs }) => {
            const active = activeSection?.key === key;
            return (
              <Link
                key={key}
                href={tabs[0].href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-5", active && "text-primary")} aria-hidden="true" />
                {mobileLabel ?? label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
