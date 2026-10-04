import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintTrigger, PrintButton } from "../../document/[playerId]/[type]/print-trigger";
import { getCoachedTeamIds } from "@/lib/coached-teams";
import { isStaffRole } from "@/lib/auth-guards";
import { isMissingAttributeColumn } from "@/lib/attributes";
import { formatInTimezone, formatTime } from "@/lib/time";
import { buildSheetRows, readSheetPlan, type SheetPlayer } from "@/lib/match-sheet";
import { cleanPhaseRatings, ratedPhases } from "@/lib/match-phases";

/**
 * A printable team sheet before a match, or match report after it (the
 * lineup and report export borrowed from Finalthird). Same print-to-PDF
 * pipeline as the term report: a plain page and the browser's own print
 * dialog. Staff only, and only for a team the caller coaches (or an admin):
 * it carries children's names, availability and coach notes.
 */
export default async function MatchSheetPrintPage({ params }: { params: Promise<{ fixtureId: string }> }) {
  const { fixtureId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !isStaffRole(profile.role)) notFound();

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
  if (!fixture) notFound();

  if (profile.role !== "admin") {
    const coached = await getCoachedTeamIds(supabase, user.id);
    if (!fixture.team_id || !coached.includes(fixture.team_id)) notFound();
  }

  type One<T> = T | T[] | null;
  const one = <T,>(v: One<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);
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

  // Availability from migration 039, tolerated when absent like the fixture page.
  const availability: Record<string, { status: string }> = {};
  if (squad.length) {
    const res = await supabase.from("players").select("id, availability_status").in("id", squad.map((p) => p.id));
    if (!isMissingAttributeColumn(res.error)) {
      for (const r of (res.data ?? []) as { id: string; availability_status: string }[]) availability[r.id] = { status: r.availability_status };
    }
  }

  // Phase ratings from migration 061, read on their own for the same reason.
  let phases: ReturnType<typeof ratedPhases> = [];
  if (after) {
    const { data: phaseRow, error } = await supabase.from("match_results").select("phase_ratings").eq("fixture_id", fixtureId).maybeSingle();
    if (!error) phases = ratedPhases(cleanPhaseRatings((phaseRow as { phase_ratings?: unknown } | null)?.phase_ratings));
  }

  const rows = buildSheetRows({
    squad,
    availability,
    appearances: after
      ? ((fixture.match_appearances ?? []) as { played: boolean; players: One<SheetPlayer> }[]).flatMap((a) => {
          const p = one(a.players);
          return p ? [{ player: p, played: a.played }] : [];
        })
      : undefined,
    ratings: after
      ? ((fixture.player_ratings ?? []) as { rating: number; note: string | null; player_id: string }[]).map((r) => ({
          playerId: r.player_id, rating: r.rating, note: r.note,
        }))
      : undefined,
  });
  const plan = readSheetPlan((planRow as { data?: unknown } | null)?.data);
  const date = new Date(fixture.fixture_date);
  const title = after ? "Match Report" : "Team Sheet";
  const us = team?.name ?? "Growfit";
  const home = fixture.is_home ? us : fixture.opponent;
  const away = fixture.is_home ? fixture.opponent : us;
  const score = result ? (fixture.is_home ? `${result.team_score} – ${result.opponent_score}` : `${result.opponent_score} – ${result.team_score}`) : null;
  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

  return (
    <>
      <PrintTrigger />
      <PrintButton />
      <style>{`
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
      `}</style>

      <div className="page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/growfit.png" alt="Growfit FA" className="header-logo" />
            <div>
              <h1>Growfit Football Academy</h1>
              <h2>{title}{team ? ` · ${team.name}${team.age_group ? ` (${team.age_group})` : ""}` : ""}</h2>
            </div>
          </div>
        </div>
        <hr className="divider" />

        <p className="fixture">
          {home} {score ? <span style={{ margin: "0 10px" }}>{score}</span> : <span className="muted" style={{ margin: "0 10px", fontWeight: 400 }}>vs</span>} {away}
        </p>
        <p className="when">
          {formatInTimezone(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Kick-off {formatTime(date)}
          {fixture.venue ? ` · ${fixture.venue}` : ""}
        </p>

        <h3>{after ? "Squad on the day" : "Squad"}</h3>
        {rows.length === 0 ? (
          <p className="body muted">No players in this squad yet.</p>
        ) : (
          <table>
            <thead>
              {after ? (
                <tr><th style={{ width: 28 }}>#</th><th>Player</th><th>Pos</th><th>Played</th><th>Rating</th><th>Coach note</th></tr>
              ) : (
                <tr><th style={{ width: 40 }}>Shirt</th><th>Player</th><th>Pos</th><th>Start</th><th>Sub</th><th>Minutes</th><th>Notes</th></tr>
              )}
            </thead>
            <tbody>
              {rows.map((r, i) =>
                after ? (
                  <tr key={r.id}>
                    <td className="muted">{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.position}</td>
                    <td>{r.played === null ? <span className="muted">Not logged</span> : r.played ? "Yes" : "No"}</td>
                    <td>{r.rating ? <span className="stars">{stars(r.rating)}</span> : <span className="muted">—</span>}</td>
                    <td>{r.note ?? ""}</td>
                  </tr>
                ) : (
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
                )
              )}
            </tbody>
          </table>
        )}

        {after && phases.length > 0 && (
          <>
            <h3>Phases of play</h3>
            <table>
              <tbody>
                {phases.map((p) => (
                  <tr key={p.id}><td>{p.label}</td><td style={{ textAlign: "right" }}><span className="stars">{stars(p.rating)}</span></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {after && result?.match_notes && (
          <>
            <h3>Match notes</h3>
            <p className="body">{result.match_notes}</p>
          </>
        )}

        {plan && (
          <>
            <h3>Match plan</h3>
            {plan.summary && <p className="body"><strong>{plan.summary}</strong></p>}
            {plan.shape && <p className="body">{plan.shape}</p>}
            {plan.inPossession.length > 0 && (<><p className="body"><strong>In possession</strong></p><ul>{plan.inPossession.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
            {plan.outOfPossession.length > 0 && (<><p className="body"><strong>Out of possession</strong></p><ul>{plan.outOfPossession.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
            {plan.setPieces && (
              <p className="body">
                <strong>Set pieces.</strong>
                {plan.setPieces.attacking && ` Attacking: ${plan.setPieces.attacking}`}
                {plan.setPieces.defending && ` Defending: ${plan.setPieces.defending}`}
              </p>
            )}
            {!after && plan.teamTalk.length > 0 && (<><p className="body"><strong>Team talk</strong></p><ul>{plan.teamTalk.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
          </>
        )}

        <div className="footer">
          <span>Contains children&apos;s personal information (POPIA). Keep it with staff; do not post it in WhatsApp groups.</span>
          <span>Printed {formatInTimezone(new Date(), { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>
    </>
  );
}
