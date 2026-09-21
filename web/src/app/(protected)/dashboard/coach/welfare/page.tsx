import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getWelfareAlerts } from "@/app/actions/welfare";
import { WelfareCheckinsPanel } from "@/components/welfare/welfare-checkins-panel";
import {
  ATTENDANCE_WINDOW_DAYS,
  WELFARE_ATTENDANCE_THRESHOLD,
} from "@/lib/attendance";

export const metadata = { title: "Welfare check-ins" };

/**
 * Welfare check-ins, on their own page.
 *
 * This panel used to sit at the top of the coach dashboard, above "what's
 * next". That put a standing list of children who need a conversation in the
 * way of the everyday job — fixtures, training, squad — every single time a
 * coach opened the app, and an alert that is always there stops being read.
 *
 * It is not a notification, either: the list only clears when a player's
 * attendance actually recovers, so it can legitimately sit unchanged for
 * weeks. That is the wrong shape for a dashboard banner and the right shape
 * for a page you go to.
 *
 * The dashboard keeps a one-line count linking here, so the signal is still
 * visible the moment a coach opens the app — it just no longer sits between
 * them and Sunday's fixture.
 */
export default async function CoachWelfarePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const result = await getWelfareAlerts();
  const alerts = "alerts" in result ? result.alerts : [];
  const loadError = "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/coach">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <HeartPulse className="size-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          Welfare check-ins
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Players below the {Math.round(WELFARE_ATTENDANCE_THRESHOLD * 100)}% training
          attendance threshold over the last {ATTENDANCE_WINDOW_DAYS} days. The academy&apos;s
          attendance policy is that this triggers a check-in, not a punishment.
        </p>
      </div>

      {loadError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle>Couldn&apos;t load welfare alerts</CardTitle>
            <CardDescription>
              {loadError} This isn&apos;t the same as &ldquo;nobody needs a check-in&rdquo; — try
              reloading.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : alerts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Everyone is turning up</CardTitle>
            <CardDescription>
              No player across your teams is below the threshold right now. This list
              recalculates every time you open it, so a player appears here the moment
              their attendance slips and leaves the moment it recovers.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <WelfareCheckinsPanel alerts={alerts} />
      )}
    </div>
  );
}
