"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Eye, EyeOff, Shield, Target, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { registerSchema, type RegisterInput } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";
import { normalizeAccessCode, describeAccessCodeKind, type PeekAccessCodeResult } from "@/lib/access-codes";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

// No 'admin' key — RegisterInput["role"] can't be admin (see below).
const ROLE_ROUTES: Record<string, string> = {
  coach: "/dashboard/coach",
  player: "/dashboard/player",
  parent: "/dashboard/parent",
};

// Admin is deliberately not offered here — an admin role only ever comes
// from /register-club (creating a fresh academy), which sets it itself via
// register_academy(). This page used to also let you pick "Admin" and enter
// an existing club's join code, but that write went straight through a
// client-side .update() with no server-side check that a valid code was
// even given — anyone could PATCH their own role to admin.
const ROLES = [
  { value: "player" as const, label: "Player",  description: "Build your passport and get seen.", Icon: Target },
  { value: "coach"  as const, label: "Coach",   description: "Manage your squad and log results.", Icon: Users },
  { value: "parent" as const, label: "Parent",  description: "Follow your child's progress.", Icon: Shield },
];

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const selectedRole = watch("role");
  const clubCodeValue = watch("club_code") ?? "";
  const [codePeek, setCodePeek] = useState<PeekAccessCodeResult | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  async function checkCode(raw: string) {
    const code = normalizeAccessCode(raw);
    if (code.length !== 6) { setCodePeek(null); return; }
    const supabase = createClient();
    if (!supabase) return;
    setCheckingCode(true);
    const { data } = await supabase.rpc("peek_access_code", { p_code: code });
    setCheckingCode(false);
    setCodePeek((data as PeekAccessCodeResult) ?? { valid: false });
  }

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    const supabase = createClient();
    if (!supabase) { setServerError("Auth service unavailable — check Supabase env vars."); return; }

    const code = data.club_code ? normalizeAccessCode(data.club_code) : "";

    // Validate the code *before* creating the account. Checking after
    // signUp() meant a bad code left the auth user already created with no
    // way back — re-submitting the corrected code failed at signUp with
    // "User already registered", and the only exit was a bare login that
    // dumped the coach on the player dashboard with role='player' forever.
    if (code) {
      const { data: peek, error: peekError } = await supabase.rpc("peek_access_code", { p_code: code });
      if (peekError) { setServerError(peekError.message); return; }
      if (!peek?.valid) {
        setServerError("That code doesn't match a club or team. Check it with your admin.");
        return;
      }
      // A coach seat only ever comes from a real team coach code — never
      // from the academy join code, which is handed to every parent and
      // player. redeem_access_code() enforces this server-side too; this
      // is just a clearer error before the account is even created.
      if (data.role === "coach" && peek.kind !== "team_coach") {
        setServerError(
          peek.kind === "academy"
            ? "A club code can't make you a coach — ask your admin for your team's coach code instead."
            : "That's a squad invite code, not a coach code — check it with your admin."
        );
        return;
      }
      if (data.role !== "coach" && peek.kind === "team_coach") {
        setServerError("That's a coach code for a team — choose Coach to use it.");
        return;
      }
    }

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      // pending_access_code rides along in case email confirmation is on —
      // signUp() only stores metadata, it never applies the code, so
      // login-form.tsx redeems it the first time there's a real session.
      options: { data: { full_name: data.full_name, role: data.role, pending_access_code: code || null } },
    });
    if (error) { setServerError(error.message); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setConfirmationSent(true);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setServerError("Could not retrieve user after sign-up."); return; }

    if (code) {
      const { data: redeemData, error: redeemError } = await supabase.rpc("redeem_access_code", {
        p_code: code,
        p_role: data.role,
      });
      if (redeemError) { setServerError(redeemError.message); return; }
      const redeemRes = redeemData as { error?: string } | null;
      if (redeemRes?.error) { setServerError(redeemRes.error); return; }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", user.id);
    if (profileError) { setServerError(profileError.message); return; }

    // A parent used to be able to link themselves to a child here, from the
    // browser, on the strength of the child's public share token alone. That
    // was the second (undocumented) path into parent_player_links and it is
    // gone — linking now requires a code a coach issued for that child. See
    // migration 032. Parents land on their dashboard and link from there.

    router.push(ROLE_ROUTES[data.role]);
  }

  if (confirmationSent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Logo />
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            Check your email to confirm your account.
          </p>
          <Link href="/auth/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <div className="flex flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Full name */}
          <div className="space-y-1.5">
            <label htmlFor="full_name" className="text-sm font-medium">Full name</label>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              placeholder="Sipho Dlamini"
              {...register("full_name")}
              className={INPUT_CLASS}
            />
            {errors.full_name && <p role="alert" className="text-xs text-destructive">{errors.full_name.message}</p>}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
              className={INPUT_CLASS}
            />
            {errors.email && <p role="alert" className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                {...register("password")}
                className={INPUT_CLASS + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && <p role="alert" className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <p className="text-sm font-medium">I am a…</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(({ value, label, description, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue("role", value, { shouldValidate: true })}
                  aria-pressed={selectedRole === value}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                    selectedRole === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span className={cn(
                    "grid size-9 place-items-center rounded-lg",
                    selectedRole === value ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="font-semibold text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{description}</span>
                </button>
              ))}
            </div>
            {errors.role && <p role="alert" className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          {/* Access code — shown when a role is selected. Accepts any of the
              three code kinds: an academy join code, a team coach code, or
              a team's player invite code. */}
          {selectedRole && (
            <div className="space-y-1.5">
              <label htmlFor="club_code" className="text-sm font-medium">
                Club or team code {selectedRole === "player" && <span className="text-muted-foreground font-normal">(optional)</span>}
              </label>
              <div className="relative">
                <input
                  id="club_code"
                  type="text"
                  autoComplete="off"
                  placeholder="e.g. ABC123"
                  // Deliberately no maxLength here: a browser-enforced
                  // maxLength truncates *before* onChange runs, so pasting
                  // " ABC123" (7 raw chars) truncated to " ABC12" first and
                  // only then got the leading space stripped — five
                  // characters, read as "wrong length" instead of valid.
                  // Normalising first and slicing to 6 avoids that order
                  // dependency entirely.
                  {...register("club_code", {
                    onChange: (e) => {
                      e.target.value = normalizeAccessCode(e.target.value).slice(0, 6);
                      void checkCode(e.target.value);
                    },
                  })}
                  className={INPUT_CLASS + " pr-10 font-mono tracking-widest uppercase"}
                />
                {clubCodeValue.length === 6 && codePeek?.valid && (
                  <span className="absolute inset-y-0 right-0 flex items-center px-3 text-green-500 pointer-events-none">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              {clubCodeValue.length > 0 && clubCodeValue.length < 6 && !errors.club_code && (
                <p className="text-xs text-muted-foreground">{6 - clubCodeValue.length} more character{6 - clubCodeValue.length !== 1 ? "s" : ""} needed</p>
              )}
              {clubCodeValue.length === 6 && !checkingCode && codePeek && !codePeek.valid && (
                <p className="text-xs text-destructive">Doesn&apos;t match a club or team code — check with your admin.</p>
              )}
              {clubCodeValue.length === 6 && !checkingCode && codePeek?.valid && (
                <p className="text-xs text-primary">
                  Matches {describeAccessCodeKind(codePeek.kind)}.
                </p>
              )}
              {errors.club_code && <p role="alert" className="text-xs text-destructive">{errors.club_code.message}</p>}
              <p className="text-xs text-muted-foreground">
                6-character code from your club admin.{" "}
                <Link href="/register-club" className="underline">
                  Register a new club instead
                </Link>
              </p>
            </div>
          )}

          {/* Parents link a child from their dashboard, with a code their
              child's coach issues for that child specifically. */}
          {selectedRole === "parent" && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Once you have an account, ask your child&apos;s coach for a child
              link code and add them from your dashboard.
            </p>
          )}

          {serverError && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </div>
      </div>
    </div>
  );
}
