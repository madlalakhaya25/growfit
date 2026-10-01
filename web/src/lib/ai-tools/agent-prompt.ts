import { COACH_SYSTEM, getLTPDPhase } from "@/lib/ai-safeguards";
import type { AgentPage } from "./agent-request";

/**
 * What being on each page means for the answer. Keyed by the closed AgentPage
 * list, so the client chooses a key and the wording stays here.
 */
const PAGE_HINTS: Record<AgentPage, string> = {
  agent: "",
  tactics:
    "The coach opened you from the Tactics page. Questions there are often about a tactical concept (pressing, build-up, transitions, set pieces) or what a position does. " +
    "Explain a concept in plain text with these labelled parts: WHAT IT IS (2-3 sentences a coach could repeat to the squad), WHY IT MATTERS at their age group (tied to the LTPD phase, including what should NOT be demanded yet), KEY PRINCIPLES (3 numbered), WHAT TO LOOK FOR (2 things), COMMON MISTAKES (2, with the fix) and COACHING CUES (3 short phrases). " +
    "Explain a position the same way: what the role is for, what it does in and out of possession, and what is age-appropriate. " +
    "You do not need a tool for a general football concept, but do use tools for anything about their own players or fixtures.",
  squad: "The coach opened you from the Squad page; questions are probably about their own players.",
  fixtures: "The coach opened you from the Fixtures page; questions are probably about results, upcoming matches or opponents.",
  training: "The coach opened you from the Training page; questions are probably about sessions, attendance or drills.",
  welfare: "The coach opened you from the Welfare page; questions are probably about attendance and who needs a check-in.",
};

/**
 * The agent's system prompt: the assistant-coach persona, adjusted for a
 * setting where there is no pre-written brief and the data comes from tools.
 * COACH_SYSTEM's "you are given a brief" is overridden explicitly, rather than
 * edited, so the other features that share COACH_SYSTEM are untouched.
 */
export function agentSystem(
  opts: { currentTeam?: { id: string; name: string; ageGroup?: string | null } | null; page?: AgentPage } = {}
): string {
  const team = opts.currentTeam
    ? ` The coach is currently looking at the team "${opts.currentTeam.name}" (team id ${opts.currentTeam.id}${
        opts.currentTeam.ageGroup ? `, age group ${opts.currentTeam.ageGroup}, LTPD phase ${getLTPDPhase(opts.currentTeam.ageGroup)}` : ""
      }); use it when they say "my team" or "the squad" without naming one, and pitch coaching advice at that age group.`
    : "";
  return (
    `${COACH_SYSTEM} ` +
    "In this conversation you are NOT given a brief. Instead you have read-only tools that look up the squad, a player, attendance, fixtures, development milestones, registration documents, welfare alerts and the drill library. " +
    "Call a tool whenever an answer depends on the academy's real data, and never answer such a question from memory or guess. Real names and numbers come only from tool results. " +
    "If a tool returns an error, or says a player is not on the coach's teams, say so plainly and do not work around it. " +
    "You can only read — never claim to have changed, sent, saved or scheduled anything. " +
    "The app shows links to the players and fixtures you mention by itself, so do not write URLs." +
    team +
    (opts.page && PAGE_HINTS[opts.page] ? ` ${PAGE_HINTS[opts.page]}` : "")
  );
}
