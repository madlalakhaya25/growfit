import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { htmlReport } from "../_html";
import { formatInTimezone } from "@/lib/time";

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin")
    return new NextResponse("Forbidden", { status: 403 });

  const { data: players } = await supabase
    .from("players")
    .select("id, full_name")
    .eq("academy_id", profile.academy_id)
    .eq("active", true);

  const playerIds = (players ?? []).map((p: { id: string; full_name: string }) => p.id);
  const playerName: Record<string, string> = {};
  for (const p of players ?? [])
    playerName[(p as { id: string; full_name: string }).id] = (p as { id: string; full_name: string }).full_name;

  const headers = ["Player", "Document", "Season", "Status", "Signed By", "Signed At", "File"];
  const rows: unknown[][] = [];

  if (playerIds.length > 0) {
    const { data: docs } = await supabase
      .from("player_documents")
      .select("player_id, document_type, season, status, signer_name, signed_at, file_name")
      .in("player_id", playerIds);

    for (const d of docs ?? []) {
      const doc = d as {
        player_id: string; document_type: string; season: string;
        status: string; signer_name: string; signed_at: string; file_name: string;
      };
      rows.push([
        playerName[doc.player_id] ?? doc.player_id,
        doc.document_type, doc.season, doc.status,
        doc.signer_name,
        doc.signed_at ? formatInTimezone(doc.signed_at) : "",
        doc.file_name,
      ]);
    }
  }

  const date = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const th = headers.map((h) => `<th>${h}</th>`).join("");
    const trs = rows.map((r) => {
      const status = String(r[3] ?? "");
      const cls = status === "signed" ? "status-signed" : status === "uploaded" ? "status-uploaded" : "status-unsigned";
      return `<tr>${r.map((c, i) => `<td${i === 3 ? ` class="${cls}"` : ""}>${c == null ? "" : String(c)}</td>`).join("")}</tr>`;
    }).join("");
    const table = `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
    const html = htmlReport("Document Compliance", `${rows.length} records`, table);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const csv = [csvRow(headers), ...rows.map(csvRow)].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compliance-${date}.csv"`,
    },
  });
}
