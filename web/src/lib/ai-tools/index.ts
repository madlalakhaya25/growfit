import { getAttendance } from "./get-attendance";
import { getDocumentStatus } from "./get-document-status";
import { getFixtures } from "./get-fixtures";
import { getMilestones } from "./get-milestones";
import { getPlayer } from "./get-player";
import { getSquad } from "./get-squad";
import { getWelfareAlerts } from "./get-welfare-alerts";
import { searchDrills } from "./search-drills";
import type { AgentTool, AgentToolContext, AgentToolResult } from "./types";

export type { AgentLink, AgentTool, AgentToolContext, AgentToolResult } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AGENT_TOOLS: AgentTool<any, any>[] = [
  getSquad,
  getPlayer,
  getAttendance,
  getFixtures,
  getMilestones,
  getDocumentStatus,
  getWelfareAlerts,
  searchDrills,
];

/** Gemini `functionDeclarations` for the registry. */
export function toolDeclarations() {
  // `parametersJsonSchema` takes plain JSON Schema (lowercase types), which is
  // what each tool's `parameters` is; `parameters` would want Gemini's own
  // upper-case `Type` enum.
  return AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters }));
}

/** Short, human label for the stream's `tool` event ("checking attendance…"). */
export const TOOL_LABELS: Record<string, string> = {
  getSquad: "looking at the squad…",
  getPlayer: "looking up the player…",
  getAttendance: "checking attendance…",
  getFixtures: "checking fixtures…",
  getMilestones: "checking development milestones…",
  getDocumentStatus: "checking registration documents…",
  getWelfareAlerts: "checking welfare alerts…",
  searchDrills: "searching the drill library…",
};

/**
 * Run one model-requested tool. Never throws: an unknown tool, rejected
 * arguments or a failed query all come back as `{ ok: false }` with a fixed
 * string the model can recover from. Provider and database error text is
 * never forwarded.
 */
export async function executeTool(
  ctx: AgentToolContext,
  name: string,
  rawArgs: unknown
): Promise<AgentToolResult> {
  const tool = AGENT_TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `Unknown tool "${name}".` };
  let input: unknown;
  try {
    input = tool.parseInput(rawArgs);
  } catch {
    input = null;
  }
  if (input === null) return { ok: false, error: `Invalid arguments for ${name}.` };
  try {
    const data = await tool.run(ctx, input);
    let links: { label: string; href: string }[] = [];
    try {
      links = tool.links?.(data) ?? [];
    } catch {
      links = [];
    }
    return { ok: true, data, links };
  } catch {
    return { ok: false, error: `${name} couldn't be completed right now.` };
  }
}
