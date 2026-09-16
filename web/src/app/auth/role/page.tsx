"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Target, Users, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import type { AuthProfile } from "@/store/authStore";
import { normalizeAccessCode } from "@/lib/access-codes";
import type { UserRole } from "@/lib/types";

/** The three roles a code can attach — never 'admin', which only ever comes
 * from /register-club (creating a fresh academy via register_academy()). */
type SelectableRole = "player" | "coach" | "parent";

const ROLES: {
  value: SelectableRole;
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
      "Watch your coach's plays and hear their voice note",
      "A guide to what your position actually does",
      "Match ratings, milestones, and training records",
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
      "AI assistant that knows your squad, suggests an XI, writes match plans",
      "Tactical board: formations, animation, video export, shared plays",
      "AI session planner (FIFA LTPD phases, 4-Corner Model drills)",
      "Ratings, attendance, announcements, and AI post-match reports",
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
  // Admin isn't offered here — it's never granted by a code. An admin who
  // reaches this page (e.g. a co-admin the founder hasn't set up yet) needs
  // an academy created via /register-club, not a role picked here.
];

const ROLE_ROUTES: Partial<Record<UserRole, string>> = {
  coach:  "/dashboard/coach",
  player: "/dashboard/player",
  parent: "/dashboard/parent",
};

const INPUT_CLASS =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function RolePage() {
  const router = useRouter();
  const setProfile = useAuthStore((s) => s.setProfile);

  const [selected, setSelected] = useState<SelectableRole | null>(null);
  const [clubCode, setClubCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!selected) return;

    const code = normalizeAccessCode(clubCode);
    const isPlayer = selected === "player";

    // Players may continue without a code — they land in a "waiting to be
    // added" state until their coach adds them. Every other role needs one.
    if (code.length === 0 && !isPlayer) {
      setError("Enter your club or team code to continue.");
      return;
    }
    if (code.length > 0 && code.length !== 6) {
      setError("Code must be exactly 6 characters.");
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
    if (!user) { router.push("/auth/login"); setLoading(false); return; }

    // redeem_access_code works out what kind of code this is (academy join
    // code, team coach code, or team invite code) and applies it — the same
    // RPC registration and /join/[code] use, so there is one implementation
    // of "what does this code do" instead of three that can drift apart.
    // It never overwrites an existing role or academy_id (see migration 027),
    // so this is safe to call even for a returning user who already has one.
    if (code) {
      const { data: redeemData, error: rpcError } = await supabase.rpc("redeem_access_code", {
        p_code: code,
        p_role: selected,
      });
      if (rpcError) { setError(rpcError.message); setLoading(false); return; }
      const res = redeemData as { error?: string } | null;
      if (res?.error) { setError(res.error); setLoading(false); return; }
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, academy_id, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !data) {
      setError(profileError?.message ?? "Could not load your profile.");
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
              <label htmlFor="club_code" className="text-sm font-medium">Club or team code</label>
              <input
                id="club_code"
                type="text"
                autoComplete="off"
                placeholder="e.g. ABC123"
                // No maxLength: a browser-enforced maxLength truncates the
                // raw pasted value *before* this onChange runs, so a pasted
                // " ABC123" (7 raw chars) got cut to " ABC12" first and only
                // then had its leading space stripped — five characters,
                // read as "wrong length" instead of a valid code.
                value={clubCode}
                onChange={(e) => setClubCode(normalizeAccessCode(e.target.value).slice(0, 6))}
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
