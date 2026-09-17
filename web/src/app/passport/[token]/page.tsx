import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingRing } from "@/components/ui/rating-ring";
import { StatBar } from "@/components/ui/stat-bar";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { POSITIONS, FEET } from "@/lib/types";
import {
  ATTR_CATEGORIES,
  ATTR_META,
  CATEGORY_LABELS,
  calculateOverall,
  getPositionAttrKeys,
  type AttrKey,
} from "@/lib/attributes";
import { calculateAge, getInitials } from "@/lib/player";
import QRCode from "qrcode";

export const revalidate = 60;

/**
 * A passport is a link meant to be shared — with a parent, a coach at another
 * club, a scout. Until now every one of them previewed as the generic site
 * title from the root layout, because nothing in this app defined
 * `generateMetadata`. A shared link showed "Growfit FA" rather than the
 * player it is about.
 *
 * Deliberately narrow: name, position, age band and academy only. No photo in
 * the OG image (photo consent gates the photo on the page itself, and a link
 * preview is cached by every platform it passes through, well beyond our
 * reach), and nothing here that the page does not already show publicly.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_public_passport", {
    p_share_token: token.toLowerCase(),
  });

  if (!data || (data as { error?: string }).error) {
    return { title: "Passport not found" };
  }

  const passport = data as PassportData;
  const position = POSITIONS.find((p) => p.value === passport.position)?.label;
  const age = passport.age ?? calculateAge(passport.date_of_birth ?? null);

  const descriptor = [position, age ? `age ${age}` : null, passport.academy_name]
    .filter(Boolean)
    .join(" · ");

  const title = passport.full_name;
  const description = descriptor
    ? `${descriptor} — player passport on Growfit FA.`
    : "Player passport on Growfit FA.";

  return {
    title,
    description,
    openGraph: { type: "profile", title, description },
    twitter: { card: "summary", title, description },
    // A passport is public but not something to index and surface in search
    // results for a child's name.
    robots: { index: false, follow: false },
  };
}

type AttrData = Partial<Record<AttrKey, number>> | null;

interface PassportData {
  full_name: string;
  position: string | null;
  secondary_pos: string | null;
  preferred_foot: string | null;
  /**
   * Derived age, once migration 032 lands. Raw `date_of_birth` is an
   * identity-document field and stops being returned then; read `age` first and
   * fall back, so this page is correct before and after the migration runs.
   */
  age?: number | null;
  date_of_birth?: string | null;
  photo_url: string | null;
  share_token: string;
  academy_name: string | null;
  /**
   * `note` is a coach's free-text about a named child. Migration 032 stops
   * returning it from this unauthenticated endpoint; it stays optional here so
   * the page renders correctly before and after that migration is applied.
   */
  ratings: { rating: number; note?: string | null; fixture_date: string | null; opponent: string | null; created_at: string }[];
  attributes: AttrData;
}

export default async function PublicPassportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_public_passport", {
    p_share_token: token.toLowerCase(),
  });

  // The RPC signals an unknown token with `{ error: "Player not found." }`,
  // which is truthy — so a bare `!data` check let execution run on with every
  // field undefined, and `getInitials` (which does not guard null) threw a
  // TypeError. An invalid token rendered the 500 page instead of a 404.
  if (!data || (data as { error?: string }).error) notFound();

  // RPC returns JSON — cast it
  const passport = data as PassportData;

  const ratings = passport.ratings ?? [];
  const attrs = passport.attributes;

  const ratingValues = ratings.map((r) => r.rating);
  const matchAvg = ratingValues.length
    ? Math.round((ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length) * 20)
    : 0;
  const ratingAvgStars = ratingValues.length
    ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
    : 0;

  // Overall = mean of the attributes this player's position is assessed on;
  // falls back to the match rating average. Matches the coach-side figure
  // exactly, so a player's public number never contradicts their own page.
  const attrsOverall = calculateOverall(attrs, passport.position);
  const overall = attrsOverall ?? matchAvg;

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://growfitfa.com"}/passport/${passport.share_token}`;
  const qrDataUrl = await QRCode.toDataURL(shareUrl, { width: 160, margin: 1 });

  const posLabel = POSITIONS.find((p) => p.value === passport.position)?.label ?? "—";
  const secPosLabel = POSITIONS.find((p) => p.value === passport.secondary_pos)?.label;
  const footLabel = FEET.find((f) => f.value === passport.preferred_foot)?.label;
  const age = passport.age ?? calculateAge(passport.date_of_birth ?? null);
  const initials = getInitials(passport.full_name);

  const ltpdPhase = (() => {
    if (!age) return null;
    if (age <= 9)  return "FUNdamentals";
    if (age <= 12) return "Learning to Train";
    if (age <= 15) return "Training to Train";
    if (age <= 18) return "Training to Compete";
    return "Training to Win";
  })();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Academy + pathway badge strip */}
          {(passport.academy_name || ltpdPhase) && (
            <div className="flex flex-wrap items-center gap-2">
              {passport.academy_name && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium">
                  <span className="size-1.5 rounded-full bg-primary inline-block" />
                  {passport.academy_name}
                </span>
              )}
              {ltpdPhase && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/40">
                  FIFA LTPD · {ltpdPhase}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-green-300/60 bg-green-50 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700/40">
                SAFA Registered Academy
              </span>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Passport card */}
            <Card className="overflow-hidden lg:col-span-1">
              <div className="h-1.5 bg-brand" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  {passport.photo_url ? (
                    <Image
                      src={passport.photo_url}
                      alt={passport.full_name}
                      width={80}
                      height={80}
                      className="size-20 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-20 place-items-center rounded-full bg-brand/20 text-xl font-bold text-primary">
                      {initials}
                    </span>
                  )}
                  <RatingRing value={overall} size={88} />
                </div>
                <CardTitle className="mt-3 text-xl">{passport.full_name}</CardTitle>
                <CardDescription>
                  {posLabel}
                  {passport.academy_name && ` · ${passport.academy_name}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="brand">{posLabel}</Badge>
                  {secPosLabel && <Badge variant="neutral">{secPosLabel}</Badge>}
                  {age && <Badge variant="neutral">Age {age}</Badge>}
                  {footLabel && <Badge variant="neutral">{footLabel} foot</Badge>}
                </div>

                {attrs ? (
                  <div className="space-y-3 pt-1">
                    {/* Overall has never been explained anywhere it appears,
                        which invites reading it as a FIFA-style rating rather
                        than what it is. */}
                    <p className="text-xs text-muted-foreground">
                      Overall is the average of the attributes a{" "}
                      {posLabel !== "—" ? posLabel.toLowerCase() : "player"} is
                      assessed on, rated 1–99 by their coaches.
                    </p>
                    {ATTR_CATEGORIES.map((cat) => {
                      // Only what this position is assessed on, and only what
                      // a coach actually rated.
                      const keys = getPositionAttrKeys(passport.position).filter(
                        (k) => ATTR_META[k].category === cat && attrs[k] != null
                      );
                      if (keys.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            {CATEGORY_LABELS[cat]}
                          </p>
                          {keys.map((key) => (
                            <StatBar key={key} label={ATTR_META[key].label} value={attrs[key]!} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">No ability assessment yet.</p>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 text-sm border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Ratings</p>
                    <p className="font-bold text-lg tabular-nums">{ratings.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg rating</p>
                    <div className="flex gap-0.5 mt-1">
                      {[1,2,3,4,5].map((n) => (
                        <Star
                          key={n}
                          className={`size-4 ${n <= Math.round(ratingAvgStars) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-border space-y-2">
                  <p className="text-xs text-muted-foreground">Share this passport</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="Passport QR code" width={80} height={80} className="rounded-lg" />
                  <p className="text-[10px] text-muted-foreground font-mono break-all">{shareUrl}</p>
                </div>
              </CardContent>
            </Card>

            {/* Rating history */}
            <div className="space-y-4 lg:col-span-2">
              <h2 className="text-xl font-bold">Match ratings</h2>

              {ratings.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">No ratings yet</CardTitle>
                    <CardDescription>Ratings will appear after matches are logged by a coach.</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {[...ratings]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((r, i) => (
                      <div key={i} className="flex items-start gap-4 px-4 py-3">
                        <div className="flex shrink-0 gap-0.5 pt-0.5">
                          {[1,2,3,4,5].map((n) => (
                            <Star
                              key={n}
                              className={`size-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <div className="min-w-0 flex-1">
                          {r.opponent && <p className="font-medium text-sm">vs {r.opponent}</p>}
                          {!r.opponent && <p className="font-medium text-sm text-muted-foreground">Standalone assessment</p>}
                          {r.note && <p className="text-sm text-muted-foreground mt-0.5">&ldquo;{r.note}&rdquo;</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleDateString("en-ZA", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center space-y-2">
        <p className="text-sm font-semibold text-foreground">Growfit FA</p>
        <p className="text-xs text-muted-foreground">
          Youth development platform aligned with FIFA LTPD, SAFA National Development Programme, and CAF development frameworks
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          {["FIFA LTPD", "SAFA NDP", "CAF Pathway", "4-Corner Model"].map((label) => (
            <span key={label} className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {label}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
