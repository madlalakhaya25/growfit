import { getWelfareAlerts as loadWelfareAlerts } from "@/app/actions/welfare";
import { DEFAULT_MAX_ROWS, playerHref } from "./shared";
import type { AgentTool } from "./types";

interface Row {
  playerId: string; name: string; team: string; attendancePct: number;
  sessionsAssessed: number; lastCheckInAt: string | null; href?: string;
}
type Output = { error: string } | { alerts: Row[]; truncated: boolean };

/**
 * Players below the 75% attendance threshold. Wraps the welfare page's own
 * action so the agent and the page can never disagree. The free-text note on
 * a check-in is welfare-sensitive and is NOT passed on — only when it was
 * last logged; the welfare page owns the content.
 */
export const getWelfareAlerts: AgentTool<Record<string, never>, Output> = {
  name: "getWelfareAlerts",
  description: "Returns players whose training attendance is below the 75% welfare threshold.",
  parameters: { type: "object", properties: {} },
  maxRows: DEFAULT_MAX_ROWS,
  parseInput: (raw) => (raw == null || (typeof raw === "object" && !Array.isArray(raw)) ? {} : null),
  async run(ctx) {
    const res = await loadWelfareAlerts();
    if ("error" in res) return { error: "Welfare alerts couldn't be loaded right now." };
    const rows: Row[] = res.alerts.map((a) => ({
      playerId: a.playerId,
      name: a.fullName,
      team: a.teamName,
      attendancePct: a.attendancePct,
      sessionsAssessed: a.sessionsAssessed,
      lastCheckInAt: a.lastCheckin?.createdAt ?? null,
      href: playerHref(ctx, a.playerId),
    }));
    return { alerts: rows.slice(0, getWelfareAlerts.maxRows), truncated: rows.length > getWelfareAlerts.maxRows };
  },
  links: (o) => ("alerts" in o ? o.alerts.filter((a) => a.href).map((a) => ({ label: a.name, href: a.href! })) : []),
};
