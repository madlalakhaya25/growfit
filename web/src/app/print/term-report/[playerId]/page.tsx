import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintTrigger, PrintButton } from "../../document/[playerId]/[type]/print-trigger";
import { POSITIONS } from "@/lib/types";
import { calculateAge } from "@/lib/player";
import {
  ALL_ATTR_SELECT,
  CORE_ATTR_SELECT,
  ATTR_CATEGORIES,
  ATTR_META,
  CATEGORY_LABELS,
  buildAttributeSnapshot,
  isMissingAttributeColumn,
  type AttrKey,
} from "@/lib/attributes";
import { formatDayMonth, formatInTimezone } from "@/lib/time";
import {
  attendanceWindowStart,
  isAttendanceStatus,
  summariseAttendance,
  ATTENDANCE_WINDOW_DAYS,
  type AttendanceStatus,
} from "@/lib/attendance";

/**
 * One PDF per player per term (docs/BACKLOG.md 2.3) — attendance,
 * development milestones across the five corners, match ratings, a
 * coach's note, and the attribute passport, assembled from data every
 * other surface already collects. "Term" has no boundary in this schema
 * (only `season`, a year) — attendance reuses the same 90-day rolling
 * window `lib/attendance.ts` already uses as the practical proxy
 * everywhere else; milestones and documents use `season`, like they do
 * on every other page. Same print-to-PDF pipeline as the registration
 * documents (`/print/document/...`): a plain HTML page and the browser's
 * own print dialog, not a server-rendered binary.
 */
export default async function TermReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { playerId } = await params;
  const { season } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, position, date_of_birth")
    .eq("id", playerId)
    .single();
  if (!player) notFound();

  const currentSeason = season ?? new Date().getFullYear().toString();

  const { data: academyRow } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, teams ( name, age_group )")
    .eq("player_id", playerId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const team = membership?.teams
    ? (Array.isArray(membership.teams) ? membership.teams[0] : membership.teams)
    : null;

  // Attendance over the same rolling window the welfare page and the AI
  // brief already use as the practical stand-in for a school term.
  const since = attendanceWindowStart();
  const { data: sessions } = membership?.team_id
    ? await supabase
        .from("training_sessions")
        .select("id")
        .eq("team_id", membership.team_id)
        .gte("session_date", since)
    : { data: [] as { id: string }[] };
  const sessionIds = (sessions ?? []).map((s) => s.id);

  const { data: attendanceRows } = sessionIds.length
    ? await supabase
        .from("training_attendance")
        .select("status")
        .eq("player_id", playerId)
        .in("session_id", sessionIds)
    : { data: [] as { status: string }[] };
  const attendanceMarks = (attendanceRows ?? [])
    .map((r) => r.status)
    .filter(isAttendanceStatus) as AttendanceStatus[];
  const attendanceSummary = summariseAttendance(attendanceMarks);

  const [
    { data: milestoneTemplates },
    { data: completions },
    ratingsResult,
    attrsWide,
  ] = await Promise.all([
    academyRow?.academy_id
      ? supabase
          .from("development_milestone_templates")
          .select("id, title, category")
          .eq("academy_id", academyRow.academy_id)
          .or(`position.is.null,position.eq.${player.position ?? ""}`)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; title: string; category: string }[] }),
    supabase
      .from("player_milestone_completions")
      .select("template_id, note, completed_at")
      .eq("player_id", playerId)
      .eq("season", currentSeason),
    supabase
      .from("player_ratings")
      .select("rating, note, created_at, fixtures ( opponent, fixture_date )")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("player_attributes")
      .select(`${ALL_ATTR_SELECT}, notes, assessed_at`)
      .eq("player_id", playerId),
  ]);

  type AttrRow = Partial<Record<AttrKey, number | null>> & { notes: string | null; assessed_at: string | null };
  let attributeRows = (attrsWide.data ?? []) as unknown as AttrRow[];
  if (!attributeRows.length && isMissingAttributeColumn(attrsWide.error)) {
    const { data: coreRows } = await supabase
      .from("player_attributes")
      .select(`${CORE_ATTR_SELECT}, notes, assessed_at`)
      .eq("player_id", playerId);
    attributeRows = (coreRows ?? []) as unknown as AttrRow[];
  }

  const snapshot = buildAttributeSnapshot(attributeRows, player.position);

  // The most recent coach's note across all assessments of this player.
  const latestNote = [...attributeRows]
    .filter((r) => r.notes)
    .sort((a, b) => +new Date(b.assessed_at ?? 0) - +new Date(a.assessed_at ?? 0))[0]?.notes ?? null;

  type RatingRow = {
    rating: number; note: string | null; created_at: string;
    fixtures: { opponent: string; fixture_date: string } | { opponent: string; fixture_date: string }[] | null;
  };
  const ratings = (ratingsResult.data ?? []) as RatingRow[];
  const ratingAvg = ratings.length
    ? (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1)
    : null;

  type TemplateRow = { id: string; title: string; category: string };
  const templates = (milestoneTemplates ?? []) as TemplateRow[];
  const completedIds = new Set(
    ((completions ?? []) as { template_id: string }[]).map((c) => c.template_id)
  );
  const milestonesByCategory = ATTR_CATEGORIES.map((cat) => ({
    label: CATEGORY_LABELS[cat],
    templates: templates.filter((t) => t.category === cat),
  })).filter((g) => g.templates.length > 0);

  const posLabel = POSITIONS.find((p) => p.value === player.position)?.label ?? "—";
  const age = calculateAge(player.date_of_birth);
  const generatedAt = formatInTimezone(new Date(), {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: Georgia, 'Times New Roman', serif; margin: 0; background: #fff; color: #111; }
        .page { max-width: 720px; margin: 0 auto; padding: 40px 48px; }
        h1 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
        h2 { font-size: 13px; font-weight: 600; margin: 0; color: #555; }
        h3 { font-size: 13px; font-weight: 700; margin: 20px 0 8px; text-transform: uppercase; letter-spacing: .04em; color: #333; }
        .divider { border: none; border-top: 2px solid #111; margin: 16px 0; }
        .meta-row { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 4px; }
        .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #777; }
        .meta-value { font-size: 13px; font-weight: 600; }
        .stat-row { display: flex; flex-wrap: wrap; gap: 20px; margin: 8px 0 4px; }
        .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 14px; min-width: 100px; }
        .stat-num { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 10px; text-transform: uppercase; color: #777; letter-spacing: .04em; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
        th { text-align: left; padding: 5px 8px; border-bottom: 2px solid #ddd; font-size: 10px; text-transform: uppercase; color: #777; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        .note-box { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 16px; font-size: 12px; font-style: italic; margin-top: 6px; white-space: pre-line; }
        .milestone-list { list-style: none; padding: 0; margin: 4px 0; font-size: 12px; }
        .milestone-list li { padding: 2px 0; }
        .milestone-list li::before { content: "✓ "; color: #16a34a; font-weight: 700; }
        .footer { border-top: 1px solid #ddd; margin-top: 40px; padding-top: 14px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
        .header-logo { width: 48px; height: 48px; border-radius: 6px; object-fit: contain; }
        .header-brand { display: flex; align-items: center; gap: 14px; }
      `}</style>

      <div className="page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="header-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/growfit.png" alt="Growfit FA" className="header-logo" />
            <div>
              <h1>Growfit Football Academy</h1>
              <h2>Term Report</h2>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#777" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{currentSeason} Season</div>
          </div>
        </div>
        <hr className="divider" />

        <div className="meta-row">
          <div>
            <div className="meta-label">Player</div>
            <div className="meta-value">{player.full_name}</div>
          </div>
          <div>
            <div className="meta-label">Position</div>
            <div className="meta-value">{posLabel}</div>
          </div>
          {age !== null && (
            <div>
              <div className="meta-label">Age</div>
              <div className="meta-value">{age}</div>
            </div>
          )}
          {team && (
            <div>
              <div className="meta-label">Team</div>
              <div className="meta-value">{team.name}</div>
            </div>
          )}
        </div>

        <h3>Training Attendance</h3>
        <p style={{ fontSize: 11, color: "#777", margin: "0 0 4px" }}>
          Last {ATTENDANCE_WINDOW_DAYS} days
        </p>
        {attendanceSummary.pct === null ? (
          <p style={{ fontSize: 12, color: "#777" }}>No training sessions marked yet.</p>
        ) : (
          <div className="stat-row">
            <div className="stat">
              <div className="stat-num">{attendanceSummary.pct}%</div>
              <div className="stat-label">Attendance</div>
            </div>
            <div className="stat">
              <div className="stat-num">{attendanceSummary.attended}/{attendanceSummary.assessed}</div>
              <div className="stat-label">Sessions attended</div>
            </div>
          </div>
        )}

        <h3>Development Milestones — {currentSeason}</h3>
        {milestonesByCategory.length === 0 ? (
          <p style={{ fontSize: 12, color: "#777" }}>No milestones recorded yet.</p>
        ) : (
          milestonesByCategory.map((group) => {
            const done = group.templates.filter((t) => completedIds.has(t.id));
            if (done.length === 0) return null;
            return (
              <div key={group.label} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{group.label}</div>
                <ul className="milestone-list">
                  {done.map((t) => <li key={t.id}>{t.title}</li>)}
                </ul>
              </div>
            );
          })
        )}

        <h3>Match Ratings</h3>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-num">{ratings.length}</div>
            <div className="stat-label">Rated matches</div>
          </div>
          <div className="stat">
            <div className="stat-num">{ratingAvg ?? "—"}</div>
            <div className="stat-label">Average / 5</div>
          </div>
        </div>
        {ratings.length > 0 && (
          <table>
            <thead>
              <tr><th>Date</th><th>Opponent</th><th>Rating</th><th>Note</th></tr>
            </thead>
            <tbody>
              {ratings.slice(0, 10).map((r, i) => {
                const fx = Array.isArray(r.fixtures) ? r.fixtures[0] : r.fixtures;
                return (
                  <tr key={i}>
                    <td>{formatDayMonth(fx?.fixture_date ?? r.created_at)}</td>
                    <td>{fx?.opponent ?? "—"}</td>
                    <td>{r.rating}/5</td>
                    <td>{r.note ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <h3>Attribute Passport</h3>
        {snapshot.assessedKeys.length === 0 ? (
          <p style={{ fontSize: 12, color: "#777" }}>No ability assessment recorded yet.</p>
        ) : (
          <table>
            <tbody>
              {snapshot.assessedKeys.map((key) => (
                <tr key={key}>
                  <td style={{ fontWeight: 600 }}>{ATTR_META[key].label}</td>
                  <td>{snapshot.assessed[key]}/99</td>
                </tr>
              ))}
              {snapshot.overall !== null && (
                <tr>
                  <td style={{ fontWeight: 700 }}>Overall</td>
                  <td style={{ fontWeight: 700 }}>{snapshot.overall}/99</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <h3>Coach&apos;s Note</h3>
        <div className="note-box">
          {latestNote ?? "No note recorded for this term."}
        </div>

        <div className="footer">
          <span>Growfit FA · growfitfa.com</span>
          <span>Generated: {generatedAt}</span>
        </div>
      </div>

      <PrintButton />
    </>
  );
}
