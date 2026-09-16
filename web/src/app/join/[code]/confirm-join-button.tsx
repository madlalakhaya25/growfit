"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { joinByInviteCode } from "@/app/actions/squad";

/**
 * The redeem itself is a real write (adds the caller to a squad), so it must
 * not happen on a GET render — that let any link prefetch, crawler, or chat
 * preview bot silently consume the invite before a person ever saw the page.
 * This puts the mutation behind an explicit click.
 */
export function ConfirmJoinButton({ code, teamLabel }: { code: string; teamLabel?: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [result, setResult] = useState<{ success?: boolean; error?: string; teamName?: string; already?: boolean } | null>(null);

  function confirm() {
    start(async () => {
      const res = await joinByInviteCode(code);
      setResult(res);
      if (res.success) router.refresh();
    });
  }

  if (result?.success) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">{result.already ? "Already in!" : "You're in!"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.already ? (
              <>You&apos;re already a member of <span className="font-semibold text-foreground">{result.teamName}</span>.</>
            ) : (
              <>You have joined <span className="font-semibold text-foreground">{result.teamName}</span>. Welcome to the squad.</>
            )}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/dashboard/player">Go to my dashboard</Link>
        </Button>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Couldn&apos;t join</h1>
          <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard/player">Go to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Join {teamLabel ?? "this team"}?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve followed an invite link. Confirm to add yourself to the squad.
        </p>
      </div>
      <Button className="w-full" onClick={confirm} disabled={isPending}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {isPending ? "Joining…" : "Join the squad"}
      </Button>
    </div>
  );
}
