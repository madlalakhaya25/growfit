import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Phone, AlertTriangle, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { getInitials } from "@/lib/player";
import { cn } from "@/lib/utils";

/**
 * Squad, emergency contacts and next fixture on one screen — the offline
 * read this app was missing (docs/BACKLOG.md 2.8). Attendance writes
 * already queue offline; every read assumed a connection, which meant a
 * coach at a ground with no signal had no way to see the one thing the
 * Injury & Medical Emergency Policy assumes is at hand.
 *
 * No new offline-storage code: `public/sw.js` already caches every
 * navigation, network-first with a cache fallback, for the whole app. A
 * coach who opens this page once while they still have signal — before
 * setting off for an away match, say — gets it back verbatim if they open
 * it again with none. The "Loaded" timestamp below is rendered into the
 * HTML at request time, so a cached copy keeps showing when it was last
 * actually fetched rather than lying about being live.
 */
export default async function EmergencyContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: teamParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name, age_group")
    .in("id", await getCoachedTeamIds(supabase, user.id))
    .eq("active", true)
    .order("created_at");

  if (!allTeams?.length) redirect("/dashboard/coach");

  const team = allTeams.find((t) => t.id === teamParam) ?? allTeams[0];

  const [{ data: members }, { data: nextFixture }] = await Promise.all([
    supabase
      .from("team_members")
      .select("players ( id, full_name, position, photo_url, medical:player_medical ( allergies, chronic_conditions, current_medication, emergency_1_name, emergency_1_relationship, emergency_1_phone, emergency_2_name, emergency_2_relationship, emergency_2_phone ) )")
      .eq("team_id", team.id)
      .eq("active", true),
    supabase
      .from("fixtures")
      .select("opponent, venue, fixture_date, is_home")
      .eq("team_id", team.id)
      .eq("status", "upcoming")
      .order("fixture_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  type MedicalRow = {
    allergies: string | null; chronic_conditions: string | null; current_medication: string | null;
    emergency_1_name: string | null; emergency_1_relationship: string | null; emergency_1_phone: string | null;
    emergency_2_name: string | null; emergency_2_relationship: string | null; emergency_2_phone: string | null;
  };
  type PlayerRow = {
    id: string; full_name: string; position: string | null; photo_url: string | null;
    medical: MedicalRow | MedicalRow[] | null;
  };
  type MemberRow = { players: PlayerRow | PlayerRow[] | null };

  const players = ((members ?? []) as unknown as MemberRow[])
    .flatMap((m) => (m.players ? (Array.isArray(m.players) ? m.players : [m.players]) : []))
    .map((p) => ({
      ...p,
      medical: Array.isArray(p.medical) ? p.medical[0] ?? null : p.medical,
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const NOTABLE = (v: string | null | undefined) => v && v.trim().toUpperCase() !== "NONE";

  const loadedAt = new Date().toLocaleString("en-ZA", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard/coach/squad">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Squad
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Emergency Contacts</h1>
          <p className="text-sm text-muted-foreground">{team.name}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          <WifiOff className="size-3.5" aria-hidden="true" />
          Loaded {loadedAt} — safe to open with no signal
        </div>
      </div>

      {allTeams.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {allTeams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/coach/squad/emergency?team=${t.id}`}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                t.id === team.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {nextFixture && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Next fixture</p>
          <p className="mt-1 font-medium">
            {nextFixture.is_home ? "vs" : "@"} {nextFixture.opponent}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(nextFixture.fixture_date).toLocaleDateString("en-ZA", {
              weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
            })}
            {nextFixture.venue && ` · ${nextFixture.venue}`}
          </p>
        </div>
      )}

      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players in this squad yet.</p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {players.map((p) => {
            const m = p.medical;
            const flags = [
              NOTABLE(m?.allergies) ? `Allergies: ${m!.allergies}` : null,
              NOTABLE(m?.chronic_conditions) ? `Condition: ${m!.chronic_conditions}` : null,
              NOTABLE(m?.current_medication) ? `Medication: ${m!.current_medication}` : null,
            ].filter((f): f is string => f !== null);
            const contacts = [
              m?.emergency_1_name ? { name: m.emergency_1_name, relationship: m.emergency_1_relationship, phone: m.emergency_1_phone } : null,
              m?.emergency_2_name ? { name: m.emergency_2_name, relationship: m.emergency_2_relationship, phone: m.emergency_2_phone } : null,
            ].filter((c): c is { name: string; relationship: string | null; phone: string | null } => c !== null);

            return (
              <div key={p.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-primary">
                    {getInitials(p.full_name)}
                  </span>
                  <p className="font-medium">{p.full_name}</p>
                </div>

                {flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-[52px]">
                    {flags.map((f) => (
                      <span key={f} className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {contacts.length === 0 ? (
                  <p className="pl-[52px] text-xs text-muted-foreground">No emergency contact on file.</p>
                ) : (
                  <div className="grid gap-1.5 pl-[52px] sm:grid-cols-2">
                    {contacts.map((c, i) => (
                      <div key={i} className="text-sm">
                        <span className="text-muted-foreground">
                          {c.name}{c.relationship ? ` (${c.relationship})` : ""}
                        </span>
                        {c.phone && (
                          <a
                            href={`tel:${c.phone.replace(/\s+/g, "")}`}
                            className="ml-1.5 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <Phone className="size-3" aria-hidden="true" />
                            {c.phone}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
