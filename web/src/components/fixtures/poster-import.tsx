"use client";

/**
 * Upload a match poster, check what the AI read, then save.
 *
 * Two steps on purpose. Reading writes nothing; the coach edits every field in
 * the list (the model misreads names, dates and which side a score belongs
 * to), and only the ticked rows are saved. The tap targets are sized for a
 * thumb on the touchline.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { applyMatchPoster, readMatchPoster, type PosterOutcome } from "@/app/actions/match-poster";
import { rowOpponent, rowScores, type PosterMatchRow } from "@/lib/match-poster";

const INPUT =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Draft {
  source: PosterMatchRow;
  include: boolean;
  opponent: string;
  isHome: "" | "home" | "away";
  date: string;
  time: string;
  venue: string;
  teamScore: string;
  opponentScore: string;
}

function sideOf(usIsHome: boolean | null): Draft["isHome"] {
  if (usIsHome === null) return "";
  return usIsHome ? "home" : "away";
}

function toDraft(row: PosterMatchRow): Draft {
  const scores = rowScores(row);
  return {
    source: row,
    include: !row.otherAgeGroup && row.fixtureStatus !== "completed" && row.fixtureStatus !== "cancelled",
    opponent: rowOpponent(row),
    isHome: sideOf(row.usIsHome),
    date: row.date ?? "",
    time: row.time ?? "",
    venue: row.venue ?? "",
    teamScore: scores ? String(scores.team) : "",
    opponentScore: scores ? String(scores.opponent) : "",
  };
}

function outcomeLabel(o: PosterOutcome): string {
  if (o.status === "skipped") return "Not saved";
  return o.resultLogged ? `${o.status} + result` : o.status;
}

const toScore = (v: string): number | null => (/^\d{1,2}$/.test(v.trim()) ? Number(v) : null);

/** Why a ticked row can't be saved yet, or null when it can. */
function problem(d: Draft): string | null {
  if (d.opponent.trim().length < 2) return "Add the opponent.";
  if (!d.isHome) return "Choose home or away.";
  if (!d.date) return "Add the date.";
  if (!d.time) return "Add the kick-off time.";
  const a = d.teamScore.trim() !== "";
  const b = d.opponentScore.trim() !== "";
  if (a !== b) return "Add both scores, or neither.";
  if ((a && toScore(d.teamScore) === null) || (b && toScore(d.opponentScore) === null)) return "Scores must be whole numbers.";
  return null;
}

export function PosterImport({ teamId, backHref }: Readonly<{ teamId: string; backHref: string }>) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [outcomes, setOutcomes] = useState<PosterOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();

  function read(formData: FormData) {
    setError(null);
    formData.set("team_id", teamId);
    startReading(async () => {
      const res = await readMatchPoster(formData);
      if (res.error) { setError(res.error); return; }
      setDrafts((res.matches ?? []).map(toDraft));
    });
  }

  function patch(i: number, change: Partial<Draft>) {
    setDrafts((all) => all?.map((d, j) => (j === i ? { ...d, ...change } : d)) ?? null);
  }

  /** Choosing a side re-orients the scores the poster printed home-first. */
  function chooseSide(i: number, side: "" | "home" | "away") {
    setDrafts((all) => all?.map((d, j) => {
      if (j !== i) return d;
      if (!side) return { ...d, isHome: side };
      const row = { ...d.source, usIsHome: side === "home" };
      const scores = rowScores(row);
      return {
        ...d,
        isHome: side,
        opponent: rowOpponent(row),
        teamScore: scores ? String(scores.team) : "",
        opponentScore: scores ? String(scores.opponent) : "",
      };
    }) ?? null);
  }

  const chosen = (drafts ?? []).filter((d) => d.include);
  const blocked = chosen.some((d) => problem(d));

  function save() {
    setError(null);
    startSaving(async () => {
      const res = await applyMatchPoster({
        teamId,
        rows: chosen.map((d) => ({
          fixtureId: d.source.fixtureId,
          opponent: d.opponent.trim(),
          isHome: d.isHome === "home",
          date: d.date,
          time: d.time,
          venue: d.venue.trim() || null,
          teamScore: toScore(d.teamScore),
          opponentScore: toScore(d.opponentScore),
        })),
      });
      if (res.error || !res.outcomes) { setError(res.error ?? "Could not save."); toast.error(res.error ?? "Could not save."); return; }
      setOutcomes(res.outcomes);
      toast.success("Matches saved.");
    });
  }

  if (outcomes) {
    return (
      <div className="space-y-4">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {outcomes.map((o, i) => (
            <li key={`${o.opponent}-${i}`} className="space-y-1 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{o.opponent}</p>
                <Badge variant={o.status === "skipped" ? "warning" : "success"} className="capitalize shrink-0">
                  {outcomeLabel(o)}
                </Badge>
              </div>
              {o.note && <p className="text-sm text-muted-foreground">{o.note}</p>}
            </li>
          ))}
        </ul>
        <Button asChild><Link href={backHref}>Back to fixtures</Link></Button>
      </div>
    );
  }

  if (!drafts) {
    return (
      <form action={read} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="poster-file" className="text-sm font-medium">Poster photo or PDF</label>
          <input
            id="poster-file"
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full rounded-md border border-input bg-background p-2 text-base file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          />
          <p className="text-xs text-muted-foreground">
            The photo is read by AI and not stored. You check everything before it is saved.
          </p>
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={reading}>{reading ? "Reading poster…" : "Read poster"}</Button>
          <Button asChild variant="outline"><Link href={backHref}>Cancel</Link></Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Check each match against the poster. Untick any you don&apos;t want to save.
      </p>
      <ul className="space-y-3">
        {drafts.map((d, i) => {
          const why = d.include ? problem(d) : null;
          const fx = d.source.fixtureStatus;
          const closed = fx === "completed" || fx === "cancelled";
          return (
            <li key={d.source.key} className="space-y-3 rounded-xl border border-border p-4">
              <label className="flex items-center gap-3 text-base font-medium">
                <input
                  type="checkbox"
                  checked={d.include}
                  onChange={(e) => patch(i, { include: e.target.checked })}
                  className="size-5 accent-primary"
                />
                {d.source.homeTeam} v {d.source.awayTeam}
              </label>
              <div className="flex flex-wrap gap-2">
                {!d.source.fixtureId && <Badge variant="neutral">New match</Badge>}
                {d.source.fixtureId && !closed && <Badge variant="neutral">Updates an existing match</Badge>}
                {fx === "completed" && <Badge variant="warning">Already has a result</Badge>}
                {fx === "cancelled" && <Badge variant="danger">Cancelled</Badge>}
                {d.source.otherAgeGroup && <Badge variant="warning">{d.source.ageGroup}: another squad?</Badge>}
              </div>
              {d.include && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm font-medium"><span>Opponent</span>
                    <input className={INPUT} value={d.opponent} onChange={(e) => patch(i, { opponent: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm font-medium"><span>We are</span>
                    <select className={INPUT} value={d.isHome} onChange={(e) => chooseSide(i, e.target.value as Draft["isHome"])}>
                      <option value="">Choose…</option>
                      <option value="home">Home</option>
                      <option value="away">Away</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium"><span>Date</span>
                    <input type="date" className={INPUT} value={d.date} onChange={(e) => patch(i, { date: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm font-medium"><span>Kick-off</span>
                    <input type="time" className={INPUT} value={d.time} onChange={(e) => patch(i, { time: e.target.value })} />
                    {!d.source.time && <span className="block text-xs font-normal text-muted-foreground">Not on the poster.</span>}
                  </label>
                  <label className="space-y-1 text-sm font-medium sm:col-span-2"><span>Venue</span>
                    <input className={INPUT} value={d.venue} onChange={(e) => patch(i, { venue: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm font-medium"><span>Our score</span>
                    <input inputMode="numeric" className={INPUT} value={d.teamScore} onChange={(e) => patch(i, { teamScore: e.target.value })} />
                  </label>
                  <label className="space-y-1 text-sm font-medium"><span>Their score</span>
                    <input inputMode="numeric" className={INPUT} value={d.opponentScore} onChange={(e) => patch(i, { opponentScore: e.target.value })} />
                  </label>
                </div>
              )}
              {why && <p role="alert" className="text-sm text-destructive">{why}</p>}
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || chosen.length === 0 || blocked}>
          {saving ? "Saving…" : `Save ${chosen.length} match${chosen.length === 1 ? "" : "es"}`}
        </Button>
        <Button variant="outline" onClick={() => setDrafts(null)} disabled={saving}>Start again</Button>
      </div>
    </div>
  );
}
