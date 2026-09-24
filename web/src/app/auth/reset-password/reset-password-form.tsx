"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    if (!code) return;
    const supabase = createClient();
    if (!supabase) {
      // A genuine one-time setState directly in the effect body -- but this
      // only runs once per mount, guarded behind `code` even existing, and
      // is reporting that browser client construction itself failed (a
      // config problem, not a data flow this effect is meant to
      // synchronize). Deferring it further would only delay a message the
      // user needs immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionError("Auth service unavailable — check Supabase env vars.");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        setSessionError(error.message);
      } else {
        setSessionReady(true);
      }
    });
  }, [code]);

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    const supabase = createClient();
    if (!supabase) { setServerError("Auth service unavailable — check Supabase env vars."); return; }

    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setServerError(error.message);
      return;
    }
    router.push("/auth/login");
  }

  if (!code) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Logo />
          <h1 className="font-display text-2xl">Invalid link</h1>
          <p className="text-sm text-muted-foreground">
            Invalid or expired reset link. Request a new one.
          </p>
          <Link href="/auth/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Logo />
          <h1 className="font-display text-2xl">Link expired</h1>
          <p className="text-sm text-muted-foreground">{sessionError}</p>
          <Link href="/auth/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="text-muted-foreground text-sm">Verifying reset link…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <h1 className="font-display text-2xl">Set new password</h1>
          <p className="text-center text-sm text-muted-foreground">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("password")}
              className={INPUT_CLASS}
            />
            {errors.password && (
              <p role="alert" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("confirm")}
              className={INPUT_CLASS}
            />
            {errors.confirm && (
              <p role="alert" className="text-xs text-destructive">
                {errors.confirm.message}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Set new password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
