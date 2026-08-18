"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Target, Users, Building2, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { AuthProfile } from "@/store/authStore";
import type { UserRole } from "@/lib/types";

const ROLES: {
  value: UserRole;
  label: string;
  tagline: string;
  description: string;
  bullets: string[];
  color: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "player",
    label: "Player",
    tagline: "Track your game.",
    description: "See your ratings, your milestones, and how you're growing as a player.",
    bullets: [
      "Digital passport with a shareable QR code",
      "Match ratings and performance history",
      "Development milestones across 5 categories",
      "Training attendance and session records",
    ],
    color: "border-blue-500/50 bg-blue-500/5 ring-blue-500",
    Icon: Target,
  },
  {
    value: "coach",
    label: "Coach",
    tagline: "Coach smarter.",
    description: "Plan sessions, rate players, log results and let the AI do the heavy lifting.",
    bullets: [
      "AI session planner (FIFA LTPD phases, 4-Corner Model drills)",
      "Player ratings, attribute assessments, and AI insights",
      "Fixtures, training, attendance, and AI post-match reports",
      "Squad management, announcements, and media uploads",
    ],
    color: "border-primary/50 bg-primary/5 ring-primary",
    Icon: Users,
  },
  {
    value: "parent",
    label: "Parent",
    tagline: "Stay in the loop.",
    description: "Updates on training, fixtures, and how your child is developing, all in one place.",
    bullets: [
      "Live fixture and training updates",
      "AI progress reports aligned to your child's LTPD stage",
      "Sign documents digitally: POPIA, consent, medical",
      "Match ratings and milestone tracking",
    ],
    color: "border-green-500/50 bg-green-500/5 ring-green-500",
    Icon: Shield,
  },
  {
    value: "admin",
    label: "Admin",
    tagline: "Run your academy.",
    description: "Manage teams, players, and documents, with compliance dashboards benchmarked to SAFA NDP standards.",
    bullets: [
      "SAFA document compliance dashboard (6 docs per player)",
      "Academy health AI report with FIFA/SAFA benchmarks",
      "Squad, team, and player management",
      "Analytics: ratings, attendance, positions, top performers",
    ],
    color: "border-amber-500/50 bg-amber-500/5 ring-amber-500",
    Icon: Building2,
  },
];

const ROLE_ROUTES: Record<UserRole, string> = {
  admin:  "/dashboard/admin",
  coach:  "/dashboard/coach",
  player: "/dashboard/player",
  parent: "/dashboard/parent",
};

const INPUT_CLASS =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function RolePage() {
  const router = useRouter();
  const setProfile = useAuthStore((s) => s.setProfile);

  const [selected, setSelected] = useState<UserRole | null>(null);
  const [clubCode, setClubCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;

    const code = clubCode.trim();
    const isPlayer = selected === "player";

    // Players may continue without a code — they land in a "waiting to be
    // added" state until their coach adds them. Every other role needs one.
    if (code.length === 0 && !isPlayer) {
      setError("Enter your club code to continue.");
      return;
    }
    if (code.length > 0 && code.length !== 6) {
      setError("Club code must be exactly 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Auth service unavailable — check Supabase env vars.");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    let academyId: string | null = null;
    if (code.length === 6) {
      const { data: academyData, error: rpcError } = await supabase.rpc("find_academy_by_join_code", {
        p_code: code.toUpperCase(),
      });
      if (rpcError) { setError(rpcError.message); setLoading(false); return; }
      if (academyData?.error || !academyData?.academy_id) {
        setError("Invalid club code — double-check with your club admin.");
        setLoading(false);
        return;
      }
      academyId = academyData.academy_id;
    }

    const { data, error: upsertErr } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: selected,
        academy_id: academyId,
        full_name: user.email?.split("@")[0] ?? "New user",
      })
      .select("id, role, academy_id, full_name")
      .single();

    if (upsertErr || !data) {
      setError(upsertErr?.message ?? "Could not save profile.");
      setLoading(false);
      return;
    }

    const profile: AuthProfile = {
      userId: data.id,
      role: data.role as UserRole,
      academyId: data.academy_id,
      fullName: data.full_name,
    };
    setProfile(profile);
    router.push(ROLE_ROUTES[profile.role] ?? "/dashboard/player");
  }

  const selectedRole = ROLES.find((r) => r.value === selected);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-border px-4 sm:px-6">
        <Logo />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-8">
          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What&apos;s your role?</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Pick the role that fits you. Each one has its own dashboard and tools built around what you actually need.
            </p>
          </div>

          {/* Role grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map(({ value, label, tagline, description, bullets, color, Icon }) => {
              const isSelected = selected === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelected(value)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all",
                    isSelected
                      ? `${color} ring-1`
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-lg",
                        isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-semibold leading-tight">{label}</p>
                        <p className="text-xs text-muted-foreground">{tagline}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <CheckCircle2 className="size-4 text-primary-foreground" aria-hidden="true" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                  {isSelected && (
                    <ul className="mt-1 space-y-1.5 border-t border-border/60 pt-3">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-xs text-foreground/80">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>

          {/* Club code */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold">
                {selectedRole ? `Join ${selectedRole.label === "Admin" ? "your academy" : "your club"}` : "Join your club"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected === "player"
                  ? "Your club admin will give you a 6-character code. Have it? Enter it to link your academy now — otherwise you can continue without one."
                  : "Your club admin will give you a 6-character code. Enter it here to connect your account to your academy."}
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="club_code" className="text-sm font-medium">Club join code</label>
              <input
                id="club_code"
                type="text"
                autoComplete="off"
                placeholder="e.g. ABC123"
                maxLength={6}
                value={clubCode}
                onChange={(e) => setClubCode(e.target.value.toUpperCase())}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-muted-foreground">
                {selected === "player" ? (
                  <>Don&apos;t have a code yet? Continue without one — your coach will add you.</>
                ) : (
                  <>
                    Don&apos;t have a code?{" "}
                    <Link href="/register-club" className="text-primary underline underline-offset-2">
                      Register a new club instead
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            className="w-full h-11 text-base"
            disabled={!selected || loading}
            onClick={handleContinue}
          >
            {loading ? "Setting up your account…" : (
              <>
                Continue as {selectedRole?.label ?? "…"}
                <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary underline underline-offset-2">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
