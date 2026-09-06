import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingRing } from "@/components/ui/rating-ring";
import { Users } from "lucide-react";
import { POSITIONS } from "@/lib/types";
import { calculateAge, getInitials } from "@/lib/player";
import { LinkChildForm } from "./link-child-form";

const ATTR_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const;
type AttrKey = (typeof ATTR_KEYS)[number];

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
        player_attributes ( pace, shooting, passing, dribbling, defending, physical )
      )
    `)
    .eq("parent_id", user.id);

  type AttrRow = Record<AttrKey, number>;
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
    if (attrRows.length > 0) {
      const avg = (key: AttrKey) => attrRows.reduce((s, r) => s + r[key], 0) / attrRows.length;
      return Math.round(ATTR_KEYS.reduce((s, k) => s + avg(k), 0) / ATTR_KEYS.length);
    }
    const ratings = child.player_ratings.map((r) => r.rating);
    return ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20)
      : 0;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">My Children</h1>

      {/* Children grid */}
      {children.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
          <Users className="size-10 text-muted-foreground/30" aria-hidden="true" />
          <div>
            <p className="font-medium">No children linked yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enter your child&apos;s share code below to follow their progress.
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
            Enter the share code from your child&apos;s passport page, or ask their coach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LinkChildForm />
        </CardContent>
      </Card>
    </div>
  );
}
