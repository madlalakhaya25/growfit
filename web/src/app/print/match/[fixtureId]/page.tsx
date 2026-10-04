import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PrintTrigger, PrintButton } from "../../document/[playerId]/[type]/print-trigger";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isStaffRole } from "@/lib/auth-guards";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { formatInTimezone, formatTime } from "@/lib/time";
import { buildSheetRows, readSheetPlan, type SheetPlan, type SheetPlayer, type SheetRow } from "@/lib/match-sheet";
import { cleanPhaseRatings, ratedPhases } from "@/lib/match-phases";

type One<T> = T | T[] | null;
const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

interface SheetData {
  title: string;
  after: boolean;
  teamLine: string;
  home: string;
  away: string;
  score: string | null;
  date: Date;
  venue: string | null;
  rows: SheetRow[];
  phases: ReturnType<typeof ratedPhases>;
  matchNotes: string | null;
  plan: SheetPlan | null;
}

/** Availability from migration 039, tolerated when absent like the fixture page. */
async function loadAvailability(supabase: Client, squad: SheetPlayer[]) {
  const availability: Record<string, { status: string }> = {};
  if (!squad.length) return availability;
  const res = await supabase.from("players").select("id, availability_status").in("id", squad.map((p) => p.id));
  if (isMissingAttributeColumn(res.error)) return availability;
  for (const r of (res.data ?? []) as { id: string; availability_status: string }[]) {
    availability[r.id] = { status: r.availability_status };
  }
  return availability;
}

/** Phase ratings from migration 061, read on their own for the same reason. */
async function loadPhases(supabase: Client, fixtureId: string) {
  const { data, error } = await supabase.from("match_results").select("phase_ratings").eq("fixture_id", fixtureId).maybeSingle();
  if (error) return [];
  return ratedPhases(cleanPhaseRatings((data as { phase_ratings?: unknown } | null)?.phase_ratings));
}

function scoreLine(result: { team_score: number; opponent_score: number } | null, isHome: boolean): string | null {
  if (!result) return null;
  return isHome ? `${result.team_score} – ${result.opponent_score}` : `${result.opponent_score} – ${result.team_score}`;
}

/** Everything the sheet shows, or null when the caller may not see this fixture. */
async function loadSheet(supabase: Client, fixtureId: string, userId: string, role: string): Promise<SheetData | null> {
  const { data: fixture } = await supabase
    .from("fixtures")
    .select(`
      id, opponent, venue, fixture_date, is_home, status, team_id,
      teams ( name, age_group ),
      match_results ( team_score, opponent_score, match_notes ),
      match_appearances ( played, players ( id, full_name, position ) ),
      player_ratings ( rating, note, player_id )
    `)
    .eq("id", fixtureId)
    .maybeSingle();
  if (!fixture) return null;
  if (role !== "admin") {
    const coached = await getCoachedTeamIds(supabase, userId);
    if (!fixture.team_id || !coached.includes(fixture.team_id)) return null;
  }

  const team = one(fixture.teams as One<{ name: string; age_group: string | null }>);
  const result = one(fixture.match_results as One<{ team_score: number; opponent_score: number; match_notes: string | null }>);
  const after = fixture.status === "completed" && !!result;

  const [{ data: members }, { data: planRow }] = await Promise.all([
    fixture.team_id
      ? supabase.from("team_members").select("players ( id, full_name, position )").eq("team_id", fixture.team_id).eq("active", true)
      : Promise.resolve({ data: [] }),
    supabase.from("fixture_match_plans").select("data").eq("fixture_id", fixtureId).maybeSingle(),
  ]);
  const squad: SheetPlayer[] = ((members ?? []) as { players: One<SheetPlayer> }[]).flatMap((m) => {
    const p = one(m.players);
    return p ? [p] : [];
  });
  const appearances = ((fixture.match_appearances ?? []) as { played: boolean; players: One<SheetPlayer> }[]).flatMap((a) => {
    const p = one(a.players);
    return p ? [{ player: p, played: a.played }] : [];
  });
  const ratings = ((fixture.player_ratings ?? []) as { rating: number; note: string | null; player_id: string }[]).map((r) => ({
    playerId: r.player_id, rating: r.rating, note: r.note,
  }));

  const us = team?.name ?? "Growfit";
  let teamLine = "";
  if (team) teamLine = team.age_group ? ` · ${team.name} (${team.age_group})` : ` · ${team.name}`;
  return {
    title: after ? "Match Report" : "Team Sheet",
    after,
    teamLine,
    home: fixture.is_home ? us : fixture.opponent,
    away: fixture.is_home ? fixture.opponent : us,
    score: scoreLine(result, fixture.is_home),
    date: new Date(fixture.fixture_date),
    venue: fixture.venue,
    rows: buildSheetRows({
      squad,
      availability: await loadAvailability(supabase, squad),
      appearances: after ? appearances : undefined,
      ratings: after ? ratings : undefined,
    }),
    phases: after ? await loadPhases(supabase, fixtureId) : [],
    matchNotes: after ? result?.match_notes ?? null : null,
    plan: readSheetPlan((planRow as { data?: unknown } | null)?.data),
  };
}

/**
 * A printable team sheet before a match, or match report after it (the
 * lineup and report export borrowed from Finalthird). Same print-to-PDF
 * pipeline as the term report: a plain page and the browser's own print
 * dialog. Staff only, and only for a team the caller coaches (or an admin):
 * it carries children's names, availability and coach notes.
 */
export default async function MatchSheetPrintPage({ params }: Readonly<{ params: Promise<{ fixtureId: string }> }>) {
  const { fixtureId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !isStaffRole(profile.role)) notFound();

  const sheet = await loadSheet(supabase, fixtureId, user.id, profile.role);
  if (!sheet) notFound();

  return (
    <>
      <PrintTrigger />
      <PrintButton />
      <style>{SHEET_CSS}</style>
      <div className="page">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/growfit.png" alt="Growfit FA" className="header-logo" />
          <div>
            <h1>Growfit Football Academy</h1>
            <h2>{sheet.title}{sheet.teamLine}</h2>
          </div>
        </div>
        <hr className="divider" />

        <p className="fixture">
          {sheet.home}
          <span className={sheet.score ? "score" : "score muted"}>{sheet.score ?? "vs"}</span>
          {sheet.away}
        </p>
        <p className="when">
          {formatInTimezone(sheet.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Kick-off {formatTime(sheet.date)}
          {sheet.venue ? ` · ${sheet.venue}` : ""}
        </p>

        <h3>{sheet.after ? "Squad on the day" : "Squad"}</h3>
        <SquadTable rows={sheet.rows} after={sheet.after} />

        {sheet.phases.length > 0 && (
          <>
            <h3>Phases of play</h3>
            <table>
              <tbody>
                {sheet.phases.map((p) => (
                  <tr key={p.id}><td>{p.label}</td><td style={{ textAlign: "right" }}><span className="stars">{stars(p.rating)}</span></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {sheet.matchNotes && (
          <>
            <h3>Match notes</h3>
            <p className="body">{sheet.matchNotes}</p>
          </>
        )}

        {sheet.plan && <PlanSection plan={sheet.plan} after={sheet.after} />}

        <div className="footer">
          <span>Contains children&apos;s personal information (POPIA). Keep it with staff; do not post it in WhatsApp groups.</span>
          <span>Printed {formatInTimezone(new Date(), { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>
    </>
  );
}

function playedCell(played: boolean | null) {
  if (played === null) return <span className="muted">Not logged</span>;
  return played ? "Yes" : "No";
}

function SquadTable({ rows, after }: Readonly<{ rows: SheetRow[]; after: boolean }>) {
  if (rows.length === 0) return <p className="body muted">No players in this squad yet.</p>;
  if (after) {
    return (
      <table>
        <thead>
          <tr><th style={{ width: 28 }}>#</th><th>Player</th><th>Pos</th><th>Played</th><th>Rating</th><th>Coach note</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="muted">{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.position}</td>
              <td>{playedCell(r.played)}</td>
              <td>{r.rating ? <span className="stars">{stars(r.rating)}</span> : <span className="muted">—</span>}</td>
              <td>{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table>
      <thead>
        <tr><th style={{ width: 40 }}>Shirt</th><th>Player</th><th>Pos</th><th>Start</th><th>Sub</th><th>Minutes</th><th>Notes</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><span className="box" style={{ width: 26 }} /></td>
            <td>
              {r.name}
              {r.availability && <> <span className="flag">{r.availability}</span></>}
            </td>
            <td>{r.position}</td>
            <td><span className="box" /></td>
            <td><span className="box" /></td>
            <td><span className="box" style={{ width: 30 }} /></td>
            <td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bullets({ title, items }: Readonly<{ title: string; items: string[] }>) {
  if (!items.length) return null;
  return (
    <>
      <p className="body"><strong>{title}</strong></p>
      <ul>{items.map((x) => <li key={x}>{x}</li>)}</ul>
    </>
  );
}

function PlanSection({ plan, after }: Readonly<{ plan: SheetPlan; after: boolean }>) {
  return (
    <>
      <h3>Match plan</h3>
      {plan.summary && <p className="body"><strong>{plan.summary}</strong></p>}
      {plan.shape && <p className="body">{plan.shape}</p>}
      <Bullets title="In possession" items={plan.inPossession} />
      <Bullets title="Out of possession" items={plan.outOfPossession} />
      {plan.setPieces && (
        <p className="body">
          <strong>Set pieces.</strong>
          {plan.setPieces.attacking && ` Attacking: ${plan.setPieces.attacking}`}
          {plan.setPieces.defending && ` Defending: ${plan.setPieces.defending}`}
        </p>
      )}
      {!after && <Bullets title="Team talk" items={plan.teamTalk} />}
    </>
  );
}

const SHEET_CSS = `
  @media print {
    .no-print { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr { break-inside: avoid; }
  }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; background: #fff; color: #111; }
  .page { max-width: 760px; margin: 0 auto; padding: 36px 44px; }
  h1 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
  h2 { font-size: 13px; font-weight: 600; margin: 0; color: #555; }
  h3 { font-size: 13px; font-weight: 700; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #333; }
  .divider { border: none; border-top: 2px solid #111; margin: 16px 0; }
  .fixture { text-align: center; font-size: 20px; font-weight: 700; margin: 6px 0; }
  .score { margin: 0 10px; }
  .score.muted { font-weight: 400; }
  .when { text-align: center; font-size: 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th { text-align: left; padding: 5px 8px; border-bottom: 2px solid #ddd; font-size: 10px; text-transform: uppercase; color: #777; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .box { display: inline-block; width: 14px; height: 14px; border: 1px solid #999; border-radius: 2px; }
  .muted { color: #888; }
  .flag { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #b91c1c; }
  ul { margin: 4px 0; padding-left: 18px; font-size: 12px; }
  p.body { font-size: 12px; margin: 4px 0; white-space: pre-line; }
  .stars { color: #d97706; letter-spacing: 1px; }
  .footer { border-top: 1px solid #ddd; margin-top: 32px; padding-top: 12px; font-size: 10px; color: #888; display: flex; justify-content: space-between; gap: 12px; }
  .header-logo { width: 44px; height: 44px; border-radius: 6px; object-fit: contain; }
`;
