import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayerPassportCard } from "@/components/player/player-passport-card";
import { AttributeSummary } from "@/components/player/attribute-summary";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { POSITIONS, FEET } from "@/lib/types";
import {
  calculateOverall,
  getPositionAttrKeys,
  type AttrKey,
} from "@/lib/attributes";
import { calculateAge, matchRatingAverage } from "@/lib/player";
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

  // `get_public_passport`'s SQL side averages with a plain `avg()` and no
  // GROUP BY, which always returns exactly one row — all-NULL columns for a
  // player nobody has ever rated, never SQL NULL. `attrs` is therefore a
  // truthy object even with zero real assessments, so a bare `attrs ?` check
  // can never fall through to the "not yet assessed" message. Mirrors the
  // same "does this position actually have a rated attribute" check
  // AttributeSummary and calculateOverall already do.
  const hasAttrs = getPositionAttrKeys(passport.position).some(
    (key) => typeof attrs?.[key] === "number"
  );

  const ratingValues = ratings.map((r) => r.rating);
  const matchAvg = matchRatingAverage(ratingValues);
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
            <PlayerPassportCard
              className="lg:col-span-1"
              barClassName="h-1.5"
              titleClassName="text-xl"
              contentClassName="space-y-4"
              photoUrl={passport.photo_url}
              fullName={passport.full_name}
              overall={overall}
              posLabel={posLabel}
              descriptionSuffix={passport.academy_name ?? undefined}
              photoSize={80}
              ringSize={88}
              badges={
                <>
                  <Badge variant="brand">{posLabel}</Badge>
                  {secPosLabel && <Badge variant="neutral">{secPosLabel}</Badge>}
                  {age && <Badge variant="neutral">Age {age}</Badge>}
                  {footLabel && <Badge variant="neutral">{footLabel} foot</Badge>}
                </>
              }
            >
                {hasAttrs ? (
                  <div className="space-y-3 pt-1">
                    {/* Overall has never been explained anywhere it appears,
                        which invites reading it as a FIFA-style rating rather
                        than what it is. */}
                    <p className="text-xs text-muted-foreground">
                      Overall is the average of the attributes a{" "}
                      {posLabel !== "—" ? posLabel.toLowerCase() : "player"} is
                      assessed on, rated 1–99 by their coaches.
                    </p>
                    <AttributeSummary
                      attrs={attrs}
                      position={passport.position}
                      grouped
                      className="space-y-3"
                    />
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
            </PlayerPassportCard>

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
