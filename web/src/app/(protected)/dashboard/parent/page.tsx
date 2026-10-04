import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingRing } from "@/components/ui/rating-ring";
import { Users, Dumbbell, Trophy, FileSignature, MessageSquareText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ListRow, GroupedSection } from "@/components/ui/list-row";
import { IconTile } from "@/components/ui/icon-tile";
import { loadParentToday, type ParentTodayChild } from "@/lib/parent-today-data";
import { formatTime, formatWeekdayDayMonth } from "@/lib/time";
import { POSITIONS } from "@/lib/types";
import { calculateAge, getInitials } from "@/lib/player";
import { LinkChildForm } from "./link-child-form";
import {
  ALL_ATTR_SELECT,
  averageAttributeRows,
  calculateOverall,
  type AttrKey,
} from "@/lib/attributes";
import { matchRatingAverage } from "@/lib/player";


export default async function ParentDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: links } = await supabase
    .from("parent_player_links")
    .select(`
      players (
        id, full_name, position, date_of_birth, share_token,
        player_ratings ( rating ),
        player_attributes ( ${ALL_ATTR_SELECT} )
      )
    `)
    .eq("parent_id", user.id);

  type AttrRow = Partial<Record<AttrKey, number | null>>;
  type ChildPlayer = {
    id: string; full_name: string; position: string | null;
    date_of_birth: string | null; share_token: string;
    player_ratings: { rating: number }[];
    player_attributes: AttrRow[];
  };

  const children = (links ?? []).flatMap((l: { players: ChildPlayer | ChildPlayer[] | null }) =>
    Array.isArray(l.players) ? l.players : l.players ? [l.players] : []
  );

  function childOverall(child: ChildPlayer) {
    const attrRows = child.player_attributes ?? [];
    const overall = calculateOverall(averageAttributeRows(attrRows), child.position);
    if (overall !== null) return overall;
    return matchRatingAverage(child.player_ratings.map((r) => r.rating));
  }

  const now = new Date();
  const today = await loadParentToday(
    supabase,
    children.map((c) => ({ id: c.id, fullName: c.full_name })),
    now,
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Today" eyebrow={formatWeekdayDayMonth(now)} />

      {children.length > 0 && <TodaySections today={today} />}

      {children.length > 0 && (
        <p className="-mb-4 px-1 text-[13px] font-normal uppercase tracking-[0.01em] text-muted-foreground">My children</p>
      )}

      {/* Children grid */}
      {children.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="size-10 text-muted-foreground/30" aria-hidden="true" />
          <div>
            <p className="font-medium">No children linked yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ask your child&apos;s coach for a link code, then add them below.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => {
            const overall = childOverall(child);
            const pos = POSITIONS.find((p) => p.value === child.position)?.label ?? "—";
            const age = calculateAge(child.date_of_birth);
            const ratingCount = child.player_ratings.length;
            const initials = getInitials(child.full_name);

            return (
              <Link key={child.id} href={`/dashboard/parent/${child.id}`} className="block">
                <div className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
                  <div className="h-1 bg-primary" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/20 text-sm font-bold text-primary">
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight truncate">{child.full_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{pos}{age ? ` · Age ${age}` : ""}</p>
                        </div>
                      </div>
                      <RatingRing value={overall} size={56} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {child.position && (
                        <Badge variant="brand" className="text-xs">{pos}</Badge>
                      )}
                      <Badge variant="neutral" className="text-xs">
                        {ratingCount} {ratingCount === 1 ? "rating" : "ratings"}
                      </Badge>
                      {overall > 0 && (
                        <Badge variant="outline" className="text-xs font-bold">{overall}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Link child */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link a child</CardTitle>
          <CardDescription>
            Enter the link code your child&apos;s coach gave you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkChildForm />
        </CardContent>
      </Card>
    </div>
  );
}

function TodaySections({ today }: Readonly<{ today: ParentTodayChild[] | null }>) {
  if (!today) {
    return (
      <Card className="border-destructive/50 p-4 text-sm">
        Couldn&apos;t load what&apos;s coming up. This isn&apos;t the same as nothing being on. Try reloading.
      </Card>
    );
  }
  const several = today.length > 1;
  const upcoming = today
    .flatMap((c) => (c.next ? [{ child: c, event: c.next }] : []))
    .sort((a, b) => a.event.at.localeCompare(b.event.at));
  const hero = upcoming[0];
  const withForms = today.filter((c) => c.forms.length > 0);
  const withNotes = today.filter((c) => c.note);
  return (
    <>
      {hero ? (
        <Link
          href={`/dashboard/parent/${hero.child.id}`}
          className="block rounded-2xl bg-[#a71817] p-5 text-white shadow-[0_12px_28px_rgb(167_24_23/0.25)] transition-transform duration-200 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-white/90">
              {hero.event.kind === "match" ? "Next match" : "Next training"}
              {several && ` · ${hero.child.fullName}`}
            </p>
            <span className="grid size-9 place-items-center rounded-full bg-white/15">
              {hero.event.kind === "match" ? <Trophy className="size-4" aria-hidden="true" /> : <Dumbbell className="size-4" aria-hidden="true" />}
            </span>
          </div>
          <p className="mt-1.5 text-[22px] font-bold leading-tight tracking-[-0.01em]">{hero.event.title}</p>
          <p className="mt-1 text-[15px] text-white/90">
            {formatWeekdayDayMonth(new Date(hero.event.at))} · {formatTime(new Date(hero.event.at))}
            {hero.event.place && ` · ${hero.event.place}`}
          </p>
        </Link>
      ) : (
        <Card className="p-4 text-sm text-muted-foreground">Nothing coming up yet. Matches and training will show here.</Card>
      )}

      {withForms.length > 0 && (
        <GroupedSection title="Needs you">
          {withForms.map((c) => (
            <ListRow
              key={c.id}
              leading={<IconTile tone="orange"><FileSignature aria-hidden="true" /></IconTile>}
              title={`${c.fullName}: ${c.forms.length} ${c.forms.length === 1 ? "form" : "forms"} to complete`}
              subtitle={c.forms.slice(0, 2).join(", ") + (c.forms.length > 2 ? ` and ${c.forms.length - 2} more` : "")}
              href={`/dashboard/parent/${c.id}`}
            />
          ))}
        </GroupedSection>
      )}

      {withNotes.length > 0 && (
        <GroupedSection title="This week">
          {withNotes.map((c) => (
            <ListRow
              key={c.id}
              leading={<IconTile tone="blue"><MessageSquareText aria-hidden="true" /></IconTile>}
              title={c.fullName}
              subtitle={c.note}
              wrapSubtitle
              href={`/dashboard/parent/${c.id}`}
            />
          ))}
        </GroupedSection>
      )}
    </>
  );
}
