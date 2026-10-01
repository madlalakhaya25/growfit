import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import type { AiUsageSummary } from "@/lib/ai-artefacts";

/**
 * This month's AI use: calls, tokens, and how often a coach found it helpful.
 *
 * `summary: null` means the read failed or migration 045 isn't applied, so
 * every tile shows "—" (never a believable 0 -- StatTile's convention). A real
 * zero is a real zero. Tokens stay "—" even on a healthy read until at least
 * one call recorded a count, since "0 tokens" would claim they were measured.
 */
export function AiUsageCard({
  summary,
  available,
}: {
  summary: AiUsageSummary | null;
  available: boolean;
}) {
  const rated = summary ? summary.helpful + summary.notHelpful : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI use this month</CardTitle>
        <CardDescription>
          {available
            ? "Saved results only — a result served from storage costs nothing."
            : "Appears once the latest database update has been applied."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Results" value={summary ? summary.calls : null} />
          <StatTile label="Tokens" value={summary?.totalTokens != null ? summary.totalTokens.toLocaleString("en-ZA") : null} />
          <StatTile
            label="Found helpful"
            value={summary ? (rated > 0 ? `${summary.helpful} of ${rated}` : "None rated") : null}
          />
        </div>
      </CardContent>
    </Card>
  );
}
