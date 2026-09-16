import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { ConfirmJoinButton } from "./confirm-join-button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?next=/join/${code}`);
  }

  // Read-only preview of what the code grants — no write here. The actual
  // redeem only happens once the visitor clicks confirm (see the gotcha
  // this fixed: a GET that redeemed the code on render meant any link
  // prefetch, crawler, or chat preview bot silently consumed the invite).
  // peek_access_code() no longer returns a name (it was an unrate-limited
  // code→name oracle for anon — see migration 027), so there's no team name
  // to preview here any more; ConfirmJoinButton falls back to generic copy.
  // joinByInviteCode() itself still validates kind==='team_player' before
  // ever writing, so a non-squad code confirmed here errors, not mutates.

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center px-4">
          <Logo />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-5 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand/15">
            <Users className="size-7 text-primary" aria-hidden="true" />
          </span>
          <ConfirmJoinButton code={code} />
        </div>
      </main>
    </div>
  );
}
