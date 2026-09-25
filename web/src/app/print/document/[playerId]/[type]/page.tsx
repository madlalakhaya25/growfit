import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DOCUMENTS } from "@/lib/document-definitions";
import { PrintTrigger, PrintButton } from "./print-trigger";
import { formatInTimezone } from "@/lib/time";

export default async function DocumentPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string; type: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { playerId, type } = await params;
  const { season } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const def = DOCUMENTS.find((d) => d.type === type);
  if (!def) notFound();

  const { data: player } = await supabase
    .from("players")
    .select("id, full_name, position, date_of_birth")
    .eq("id", playerId)
    .single();
  if (!player) notFound();

  const currentSeason = season ?? new Date().getFullYear().toString();

  const { data: doc } = await supabase
    .from("player_documents")
    .select("status, signer_name, signer_role, signed_at, uploaded_at, upload_url")
    .eq("player_id", playerId)
    .eq("document_type", type)
    .eq("season", currentSeason)
    .maybeSingle();

  const signedAt = doc?.signed_at
    ? formatInTimezone(doc.signed_at, {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  const generatedAt = formatInTimezone(new Date(), {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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
        .divider { border: none; border-top: 2px solid #111; margin: 16px 0; }
        .meta-row { display: flex; gap: 32px; margin-bottom: 4px; }
        .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #777; }
        .meta-value { font-size: 13px; font-weight: 600; }
        .terms { font-size: 12px; line-height: 1.75; white-space: pre-line; margin: 24px 0; }
        .sig-box { border: 1px solid #ccc; border-radius: 6px; padding: 16px 20px; margin-top: 28px; background: #fafafa; }
        .sig-label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #777; margin-bottom: 6px; }
        .sig-name { font-size: 16px; font-style: italic; font-weight: 700; margin-bottom: 4px; }
        .sig-meta { font-size: 11px; color: #555; }
        .footer { border-top: 1px solid #ddd; margin-top: 40px; padding-top: 14px; font-size: 10px; color: #888; display: flex; justify-content: space-between; }
        .print-btn { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; background: #1d4ed8; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
        .header-logo { width: 48px; height: 48px; border-radius: 6px; object-fit: contain; }
        .header-brand { display: flex; align-items: center; gap: 14px; }
      `}</style>

      <div className="page">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="header-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/growfit.png" alt="Growfit FA" className="header-logo" />
            <div>
              <h1>Growfit Football Academy</h1>
              <h2>{def.label}</h2>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 11, color: "#777" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{def.form}</div>
            <div>{currentSeason} Season</div>
          </div>
        </div>
        <hr className="divider" />

        {/* Player info */}
        <div className="meta-row">
          <div>
            <div className="meta-label">Player</div>
            <div className="meta-value">{player.full_name}</div>
          </div>
          {player.date_of_birth && (
            <div>
              <div className="meta-label">Date of Birth</div>
              <div className="meta-value">
                {formatInTimezone(player.date_of_birth, {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </div>
            </div>
          )}
          <div>
            <div className="meta-label">Season</div>
            <div className="meta-value">{currentSeason}</div>
          </div>
        </div>

        <hr className="divider" style={{ borderTopWidth: 1, borderColor: "#ddd", marginTop: 12 }} />

        {/* Document body */}
        {def.terms && <div className="terms">{def.terms}</div>}

        {/* Signature block */}
        {doc?.status === "signed" && doc.signer_name ? (
          <div className="sig-box">
            <div className="sig-label">Digitally signed by</div>
            <div className="sig-name">{doc.signer_name}</div>
            {signedAt && <div className="sig-meta">Signed: {signedAt}</div>}
            <div className="sig-meta" style={{ marginTop: 4 }}>
              This digital signature was captured via the Growfit FA platform and is legally binding in terms of the
              Electronic Communications and Transactions Act 25 of 2002 (ECTA).
            </div>
          </div>
        ) : doc?.status === "uploaded" ? (
          <div className="sig-box">
            <div className="sig-label">Document status</div>
            <div className="sig-meta">Physical document uploaded on {doc.uploaded_at ? formatInTimezone(doc.uploaded_at) : "—"}.</div>
            {doc.upload_url && (
              <div className="sig-meta" style={{ marginTop: 4 }}>
                File URL: {doc.upload_url}
              </div>
            )}
          </div>
        ) : (
          <div className="sig-box" style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
            <div className="sig-label" style={{ color: "#b45309" }}>Not yet signed</div>
            <div className="sig-meta">This document has not been signed for the {currentSeason} season.</div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <span>Growfit FA · growfitfa.com</span>
          <span>Generated: {generatedAt}</span>
        </div>
      </div>

      {/* Screen-only print button */}
      <PrintButton />
    </>
  );
}
