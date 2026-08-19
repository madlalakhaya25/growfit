"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  UserCircle,
  LogOut,
  ChevronRight,
  Shield,
  Megaphone,
  Dumbbell,
  Settings,
  Download,
  Building2,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string;
  mobileHide?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin: [
    { href: "/dashboard/admin",         label: "Overview", Icon: LayoutDashboard },
    { href: "/dashboard/admin/players", label: "Players",  Icon: Users },
    { href: "/dashboard/admin/teams",   label: "Teams",    Icon: Shield },
    { href: "/dashboard/admin/reports", label: "Reports",  Icon: Download },
    { href: "/dashboard/admin/academy", label: "Academy",  Icon: Building2, mobileHide: true },
  ],
  coach: [
    { href: "/dashboard/coach", label: "Overview", mobileLabel: "Home", Icon: LayoutDashboard },
    { href: "/dashboard/coach/squad", label: "Squad", Icon: Users },
    { href: "/dashboard/coach/fixtures", label: "Fixtures", Icon: Calendar },
    { href: "/dashboard/coach/training", label: "Training", Icon: Dumbbell },
    { href: "/dashboard/coach/tactics", label: "Tactics", Icon: Lightbulb },
    { href: "/dashboard/coach/announcements", label: "Announcements", mobileLabel: "Posts", Icon: Megaphone },
  ],
  player: [
    { href: "/dashboard/player", label: "My Passport", mobileLabel: "Passport", Icon: UserCircle },
    { href: "/dashboard/player/fixtures", label: "Fixtures", Icon: Calendar },
    { href: "/dashboard/player/training", label: "Training", Icon: Dumbbell },
    { href: "/dashboard/player/tactics", label: "Tactics", Icon: Lightbulb },
    { href: "/dashboard/player/announcements", label: "Announcements", mobileLabel: "Posts", Icon: Megaphone },
  ],
  parent: [
    { href: "/dashboard/parent",               label: "My Children",   mobileLabel: "Children", Icon: UserCircle },
    { href: "/dashboard/parent/fixtures",      label: "Fixtures",                               Icon: Calendar   },
    { href: "/dashboard/parent/announcements", label: "Announcements", mobileLabel: "Posts",    Icon: Megaphone  },
  ],
};

interface Props {
  profile: { role: string; full_name: string; avatar_url: string | null };
  children: React.ReactNode;
}

export function DashboardShell({ profile, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const clearAuth = useAuthStore((s) => s.clear);
  const supabase = createClient();

  const navItems = NAV_BY_ROLE[profile.role as UserRole] ?? [];
  const [isSigningOut, startSignOut] = useTransition();

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
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
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
            href={`/dashboard/${profile.role}/settings`}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              pathname.startsWith(`/dashboard/${profile.role}/settings`) && "bg-primary/10 text-primary"
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
        {/* Mobile / shared top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 lg:px-6">
          {/* Mobile: current page title | Desktop: empty (sidebar has branding) */}
          <p className="text-base font-semibold lg:hidden">
            {navItems.find(({ href }) => pathname === href || pathname.startsWith(href + "/"))?.label ?? ""}
          </p>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href={`/dashboard/${profile.role}/settings`}
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

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          {children}
        </main>

        {/* ── Mobile bottom nav ─────────────────────────────── */}
        <nav className="flex border-t border-border bg-background lg:hidden" aria-label="Mobile navigation">
          {navItems.filter((item) => !item.mobileHide).map(({ href, label, mobileLabel, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
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
