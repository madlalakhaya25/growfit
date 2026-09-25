import { formatInTimezone } from "@/lib/time";

export function htmlTable(headers: string[], rows: unknown[][]): string {
  const th = headers.map((h) => `<th>${h}</th>`).join("");
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c == null ? "" : String(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function htmlReport(
  title: string,
  subtitle: string,
  table: string,
  options: { landscape?: boolean; footerNote?: string } = {}
): string {
  const { landscape = false, footerNote = "" } = options;
  const date = formatInTimezone(new Date(), {
    day: "numeric", month: "long", year: "numeric",
  });
  const pageSize = `A4${landscape ? " landscape" : ""}`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title} — Growfit FA</title>
<style>
  @page { size: ${pageSize}; margin: ${landscape ? "15mm 12mm" : "20mm 15mm"}; }
  @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: ${landscape ? "9px" : "11px"}; color: #111; background: #fff; }
  .page { max-width: ${landscape ? "1100px" : "900px"}; margin: 0 auto; padding: ${landscape ? "20px" : "24px"}; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  .header-brand { display: flex; align-items: center; gap: 12px; }
  .header-logo { width: ${landscape ? "36px" : "44px"}; height: ${landscape ? "36px" : "44px"}; border-radius: 6px; object-fit: contain; }
  .header h1 { font-size: ${landscape ? "14px" : "16px"}; font-weight: 700; line-height: 1.2; }
  .header p { font-size: ${landscape ? "9px" : "11px"}; color: #555; margin-top: 2px; }
  .meta { font-size: 10px; text-align: right; color: #666; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; font-size: ${landscape ? "8.5px" : "10px"}; }
  th { background: #f3f4f6; text-align: left; padding: ${landscape ? "5px 6px" : "6px 8px"}; font-weight: 700; border: 1px solid #d1d5db; white-space: nowrap; }
  td { padding: ${landscape ? "4px 6px" : "5px 8px"}; border: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  td.status-signed { color: #16a34a; font-weight: 600; }
  td.status-uploaded { color: #2563eb; font-weight: 600; }
  td.status-unsigned { color: #9ca3af; }
  .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
  .print-btn { position: fixed; bottom: 20px; right: 20px; padding: 10px 18px; background: #1d4ed8; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="header-brand">
      <img src="/growfit.png" alt="Growfit FA" class="header-logo" />
      <div>
        <h1>Growfit Football Academy</h1>
        <p>${title} — ${subtitle}</p>
      </div>
    </div>
    <div class="meta"><strong>Growfit FA</strong><br>Generated: ${date}</div>
  </div>
  ${table}
  <div class="footer">
    <span>Growfit FA · growfitfa.com${footerNote ? " · " + footerNote : ""}</span>
    <span>${date}</span>
  </div>
</div>
<button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
<script>setTimeout(function(){ window.print(); }, 800);</script>
</body></html>`;
}
