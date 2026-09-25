import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { htmlTable, htmlReport } from "../_html";
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
    .select(`
      full_name, position, preferred_foot, date_of_birth, share_token,
      school, home_address, id_number, mysafa_number,
      player_medical ( blood_type, allergies, chronic_conditions, current_medication,
        emergency_1_name, emergency_1_relationship, emergency_1_phone,
        emergency_2_name, emergency_2_relationship, emergency_2_phone,
        has_medical_aid, medical_aid_scheme, medical_aid_number, doctor_clinic, nearest_hospital,
        treatment_authorised, authorised_by ),
      player_consents ( participation_consent, photo_consent, transport_consent, risk_acknowledged, signed_by, signed_at )
    `)
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("full_name");

  const headers = [
    "Name", "Position", "Foot", "Date of Birth", "Share Token",
    "School", "Home Address", "ID/Birth Cert", "MYSAFA No",
    "Blood Type", "Allergies", "Conditions", "Medication",
    "Emergency 1 Name", "Rel", "Phone", "Emergency 2 Name", "Rel", "Phone",
    "Medical Aid", "Scheme", "Medical Aid No", "Doctor/Clinic", "Nearest Hospital",
    "Treatment Authorised", "Authorised By",
    "Participation Consent", "Photo Consent", "Transport Consent", "Risk Ack",
    "Consents Signed By", "Consents Signed At",
  ];

  const rows = (players ?? []).map((p) => {
    const med = Array.isArray(p.player_medical) ? p.player_medical[0] : p.player_medical;
    const con = Array.isArray(p.player_consents) ? p.player_consents[0] : p.player_consents;
    return [
      p.full_name, p.position, p.preferred_foot, p.date_of_birth, p.share_token,
      p.school, p.home_address, p.id_number, p.mysafa_number,
      med?.blood_type, med?.allergies, med?.chronic_conditions, med?.current_medication,
      med?.emergency_1_name, med?.emergency_1_relationship, med?.emergency_1_phone,
      med?.emergency_2_name, med?.emergency_2_relationship, med?.emergency_2_phone,
      med?.has_medical_aid ? "Yes" : "No",
      med?.medical_aid_scheme, med?.medical_aid_number, med?.doctor_clinic, med?.nearest_hospital,
      med?.treatment_authorised ? "Yes" : "No", med?.authorised_by,
      con?.participation_consent ? "Yes" : "No",
      con?.photo_consent ? "Yes" : "No",
      con?.transport_consent ? "Yes" : "No",
      con?.risk_acknowledged ? "Yes" : "No",
      con?.signed_by,
      con?.signed_at ? formatInTimezone(con.signed_at) : "",
    ];
  });

  const date = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const html = htmlReport(
      "Player Records",
      `${rows.length} active players`,
      htmlTable(headers, rows),
      { landscape: true, footerNote: "POPIA compliant — handle with care" }
    );
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const csv = [csvRow(headers), ...rows.map(csvRow)].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="players-${date}.csv"`,
    },
  });
}
