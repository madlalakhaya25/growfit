"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { SIMPLE_FEATURES } from "@/lib/features";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export default function RegisterClubPage() {
  const router = useRouter();

  const [clubName, setClubName] = useState("");
  const [province, setProvince] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [registeredClubName, setRegisteredClubName] = useState<string | null>(null);
  // When a user confirms their email and comes back to this page, they're already
  // authenticated but haven't created their club yet — skip sign-up in that case.
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (!user) return;
      // If they already have an academy, send them to the dashboard.
      supabase
        .from("profiles")
        .select("academy_id")
        .eq("id", user.id)
        .single()
        .then(({ data }: { data: { academy_id: string | null } | null }) => {
          if (data?.academy_id) { router.replace("/dashboard/admin"); return; }
          setAlreadyAuthed(true);
        });
    });
  }, [router]);

  function validate(): string | null {
    if (!clubName.trim() || clubName.trim().length < 2) return "Club name must be at least 2 characters.";
    if (!alreadyAuthed) {
      if (!fullName.trim() || fullName.trim().length < 2) return "Enter your full name.";
      if (!email.trim() || !email.includes("@")) return "Enter a valid email address.";
      if (!password || password.length < 8) return "Password must be at least 8 characters.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const validationError = validate();
    if (validationError) { setServerError(validationError); return; }

    setIsSubmitting(true);

    const supabase = createClient();
    if (!supabase) { setServerError("Auth service unavailable — check Supabase env vars."); setIsSubmitting(false); return; }

    if (!alreadyAuthed) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim(), role: "admin", pending_club_create: true } },
      });

      if (signUpError) { setServerError(signUpError.message); setIsSubmitting(false); return; }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setConfirmationSent(true);
        setIsSubmitting(false);
        return;
      }
    }

    // Register the academy via RPC
    const { data: academyData, error: rpcError } = await supabase.rpc("register_academy", {
      p_name: clubName.trim(),
      p_province: province.trim() || null,
    });

    if (rpcError || academyData?.error) {
      setServerError(rpcError?.message ?? academyData?.error ?? "Failed to create academy.");
      setIsSubmitting(false);
      return;
    }

    // A new academy starts on the simple menu (lib/features.ts). Best effort:
    // if this fails the academy still works, just with every feature on.
    if (academyData.academy_id) {
      await supabase.from("academies").update({ features: SIMPLE_FEATURES }).eq("id", academyData.academy_id);
    }

    setJoinCode(academyData.join_code);
    setRegisteredClubName(academyData.name ?? clubName.trim());
    setIsSubmitting(false);
  }

  // Success state — show join code prominently
  if (joinCode) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <Logo />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Club registered!</h1>
            <p className="text-sm text-muted-foreground">
              Welcome to <span className="font-semibold text-foreground">{registeredClubName}</span>. Share this code with your coaches and players when they register.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Your club code</p>
            <p className="font-mono text-5xl font-extrabold tracking-widest text-primary">{joinCode}</p>
          </div>

          <p className="text-sm text-muted-foreground">
            Members enter this code when they sign up at{" "}
            <Link href="/auth/register" className="underline font-medium text-foreground">/auth/register</Link>.
          </p>

          <Button className="w-full" onClick={() => router.push("/dashboard/admin")}>
            Go to admin dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Email confirmation state
  if (confirmationSent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Logo />
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            Confirm your email address to complete club registration.
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
            <h1 className="text-2xl font-bold tracking-tight">Register your club</h1>
            <p className="text-center text-sm text-muted-foreground">
              Create your academy and get a join code for your coaches and players.
            </p>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-primary hover:underline underline-offset-4">
                Sign in
              </Link>
              {" · "}
              <Link href="/auth/register" className="font-medium text-primary hover:underline underline-offset-4">
                Register as a member
              </Link>
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {alreadyAuthed && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                You&apos;re signed in. Just name your club and we&apos;ll get you set up.
              </p>
            )}

            {/* Club name */}
            <div className="space-y-1.5">
              <label htmlFor="club_name" className="text-sm font-medium">Club name</label>
              <input
                id="club_name"
                type="text"
                autoComplete="organization"
                placeholder="Growfit FC"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>

            {/* Province / City */}
            <div className="space-y-1.5">
              <label htmlFor="province" className="text-sm font-medium">
                Province / City <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="province"
                type="text"
                autoComplete="address-level2"
                placeholder="e.g. Gauteng, Cape Town"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            {/* Personal details — only shown when not already signed in */}
            {!alreadyAuthed && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="full_name" className="text-sm font-medium">Your full name</label>
                  <input
                    id="full_name"
                    type="text"
                    autoComplete="name"
                    placeholder="Sipho Dlamini"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium">Email address</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className={INPUT_CLASS}
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>
              </>
            )}

            {serverError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating your club…" : "Register club"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
