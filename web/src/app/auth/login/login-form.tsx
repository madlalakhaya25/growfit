"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginInput } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const ROLE_ROUTES: Record<string, string> = {
  admin:  "/dashboard/admin",
  coach:  "/dashboard/coach",
  player: "/dashboard/player",
  parent: "/dashboard/parent",
};

/** Only ever follow `next` back to a path within this app — never an absolute
 * or protocol-relative URL, which would make this an open redirect. */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit({ email, password }: LoginInput) {
    setServerError(null);
    const supabase = createClient();
    if (!supabase) { setServerError("Auth service unavailable — check Supabase env vars."); return; }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setServerError(error.message);
      return;
    }

    const user = data.user;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, role, academy_id, full_name")
      .eq("id", user.id)
      .single();

    if (!profileData?.role) {
      const pendingCreate = user.user_metadata?.pending_club_create === true;
      router.push(pendingCreate ? "/register-club" : "/auth/role");
      return;
    }

    // A returning, already-registered user who was bounced here from a page
    // like /join/[code] goes back to finish what they came for, rather than
    // landing on their generic dashboard and losing the invite code.
    router.push(next ?? ROLE_ROUTES[profileData.role] ?? "/dashboard/player");
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </Link>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3">
            <Logo />
            <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="text-center text-sm text-muted-foreground">
              Enter your email and password to sign in.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                {...register("email")}
                className={INPUT_CLASS}
              />
              {errors.email && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
              {errors.password && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>

            <div className="flex flex-col items-center gap-2 text-sm text-center">
              <Link
                href="/auth/forgot-password"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
              <span className="text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
                  Create one
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
