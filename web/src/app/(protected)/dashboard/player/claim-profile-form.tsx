"use client";
import { useActionState } from "react";
import { claimPlayerProfile, claimPlayerByRegistration } from "@/app/actions/player";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ClaimProfileForm() {
  const [regState, regAction, regPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return await claimPlayerByRegistration(formData) ?? null;
    },
    null
  );
  const [state, action, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return await claimPlayerProfile(formData) ?? null;
    },
    null
  );

  return (
    <div className="space-y-4">
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Already registered with SAFA?</CardTitle>
        <CardDescription>
          If your coach registered you, enter the SAFA or FIFA number from your
          registration card along with your date of birth.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={regAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg_number" className="text-sm font-medium">Registration number</label>
            <input
              id="reg_number"
              name="reg_number"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. 0VX7S or 1P7BXZ7"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reg_dob" className="text-sm font-medium">Date of birth</label>
            <input
              id="reg_dob"
              name="date_of_birth"
              type="date"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {regState?.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {regState.error}
            </p>
          )}

          <button
            type="submit"
            disabled={regPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {regPending ? "Finding you…" : "Find my profile"}
          </button>
        </form>
      </CardContent>
    </Card>

    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Link your player profile</CardTitle>
        <CardDescription>
          Enter the share token your coach gave you. You can find it on your physical
          squad sheet or by asking your coach directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="share_token" className="text-sm font-medium">
              Share token
            </label>
            <input
              id="share_token"
              name="share_token"
              type="text"
              required
              autoComplete="off"
              placeholder="e.g. a1b2c3d4e5"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {state?.error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Linking…" : "Link profile"}
          </button>
        </form>
      </CardContent>
    </Card>
    </div>
  );
}
