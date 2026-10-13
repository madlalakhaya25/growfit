import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { htmlTable, htmlReport } from "../_html";
import { getAuthUser } from "@/lib/auth";

function csvEscape(val: unknown): string {
  const s = val == null ? "" : String(val);
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin")
    return new NextResponse("Forbidden", { status: 403 });

  const { data: teams } = await supabase
    .from("teams")
    .select("id")
    .eq("academy_id", profile.academy_id);
  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);

  const headers = ["Session", "Date", "Type", "Team", "Player", "Status"];
  const rows: unknown[][] = [];

  if (teamIds.length > 0) {
    const { data: sessions } = await supabase
      .from("training_sessions")
      .select(`
        title, session_date, session_type,
        teams ( name ),
        training_attendance ( status, players ( full_name ) )
      `)
      .in("team_id", teamIds)
      .order("session_date", { ascending: false });

    for (const session of sessions ?? []) {
      const teamName =
        session.teams && !Array.isArray(session.teams)
          ? (session.teams as { name: string }).name
          : Array.isArray(session.teams) && session.teams.length > 0
          ? (session.teams[0] as { name: string }).name
          : "";

      const attendance = Array.isArray(session.training_attendance)
        ? session.training_attendance
        : [];

      if (attendance.length === 0) {
        rows.push([session.title, session.session_date, session.session_type, teamName, "", ""]);
      } else {
        for (const att of attendance) {
          const a = att as { status: string; players: { full_name: string } | { full_name: string }[] | null };
          const playerName =
            a.players && !Array.isArray(a.players)
              ? (a.players as { full_name: string }).full_name
              : Array.isArray(a.players) && a.players.length > 0
              ? (a.players[0] as { full_name: string }).full_name
              : "";
          rows.push([session.title, session.session_date, session.session_type, teamName, playerName, a.status]);
        }
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const html = htmlReport("Training Attendance", `${rows.length} records`, htmlTable(headers, rows));
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const csv = [csvRow(headers), ...rows.map(csvRow)].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance-${date}.csv"`,
    },
  });
}
