import { COACH_SYSTEM } from "@/lib/ai-safeguards";

/**
 * The agent's system prompt: the assistant-coach persona, adjusted for a
 * setting where there is no pre-written brief and the data comes from tools.
 * COACH_SYSTEM's "you are given a brief" is overridden explicitly, rather than
 * edited, so the other features that share COACH_SYSTEM are untouched.
 */
export function agentSystem(opts: { currentTeam?: { id: string; name: string } | null } = {}): string {
  const team = opts.currentTeam
    ? ` The coach is currently looking at the team "${opts.currentTeam.name}" (team id ${opts.currentTeam.id}); use it when they say "my team" or "the squad" without naming one.`
    : "";
  return (
    `${COACH_SYSTEM} ` +
    "In this conversation you are NOT given a brief. Instead you have read-only tools that look up the squad, a player, attendance, fixtures, development milestones, registration documents, welfare alerts and the drill library. " +
    "Call a tool whenever an answer depends on the academy's real data, and never answer such a question from memory or guess. Real names and numbers come only from tool results. " +
    "If a tool returns an error, or says a player is not on the coach's teams, say so plainly and do not work around it. " +
    "You can only read — never claim to have changed, sent, saved or scheduled anything. " +
    "The app shows links to the players and fixtures you mention by itself, so do not write URLs." +
    team
  );
}
