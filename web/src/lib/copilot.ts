// Think-it-through copilot: the pure half (docs/FEATURE_SPECS/coach-copilot.md).
// A coach names a problem; the model helps them reason about it. The answer is
// a draft for that coach only, so nothing here is ever sent to a player or parent.

export const MAX_COPILOT_PROBLEM = 300;
export const MAX_COPILOT_CURRICULUM_ITEMS = 25;

/** The answer's sections, in the order the coach reads them. The model must use these exact headings. */
export const COPILOT_SECTIONS = [
  { key: "causes", heading: "POSSIBLE CAUSES", title: "Possible causes" },
  { key: "ask", heading: "QUESTIONS TO ASK YOURSELF", title: "Questions to ask yourself" },
  { key: "idea", heading: "THE IDEA IN PLAIN WORDS", title: "The idea in plain words" },
  { key: "sessions", heading: "SESSION IDEAS", title: "Session ideas" },
  { key: "points", heading: "COACHING POINTS", title: "Coaching points" },
  { key: "watch", heading: "WATCH FOR NEXT MATCH", title: "Watch for next match" },
  { key: "followup", heading: "FOLLOW-UP QUESTIONS", title: "Follow-up questions" },
] as const;

export type CopilotSectionKey = (typeof COPILOT_SECTIONS)[number]["key"];

export interface CopilotSection {
  key: CopilotSectionKey;
  title: string;
  body: string;
}

/** One line per item, so the model can only point at items the academy wrote. */
export function curriculumLines(titles: readonly string[]): string[] {
  return titles.slice(0, MAX_COPILOT_CURRICULUM_ITEMS).map((t) => `- ${t.trim()}`);
}

/** What the model is shown. Deterministic, and names no child. */
export function copilotBrief(opts: { problem: string; ageGroup: string | null; curriculumTitles: readonly string[] }): string {
  const lines = curriculumLines(opts.curriculumTitles);
  return [
    `AGE GROUP: ${opts.ageGroup ?? "not set"}`,
    `PROBLEM THE COACH SAW: ${opts.problem.trim()}`,
    lines.length
      ? `THE ACADEMY'S CURRICULUM FOR THIS AGE (point session ideas at these by their exact wording):\n${lines.join("\n")}`
      : "THE ACADEMY'S CURRICULUM FOR THIS AGE: none written yet, so do not refer to one.",
  ].join("\n\n");
}

/** Plain text only: models sometimes add asterisks, hashes or bullets despite being told not to. */
export function stripMarkup(text: string): string {
  return text
    .replaceAll(/\*+/g, "")
    .replaceAll(/^#+\s*/gm, "")
    .replaceAll(/^\s*[-•]\s+/gm, "- ")
    .trim();
}

/**
 * Splits the model's answer on the fixed headings. A heading that is missing is
 * simply left out rather than invented; an answer with none of them is
 * returned as null so the caller can show an error instead of an empty card.
 */
export function parseCopilot(raw: string): CopilotSection[] | null {
  const text = stripMarkup(raw);
  const found = COPILOT_SECTIONS.map((s) => ({ s, at: text.toUpperCase().indexOf(s.heading) }))
    .filter((f) => f.at >= 0)
    .sort((a, b) => a.at - b.at);
  const sections: CopilotSection[] = [];
  found.forEach((f, i) => {
    const start = f.at + f.s.heading.length;
    const end = i + 1 < found.length ? found[i + 1].at : text.length;
    const body = text.slice(start, end).replace(/^[\s:]+/, "").trim();
    if (body) sections.push({ key: f.s.key, title: f.s.title, body });
  });
  return sections.length > 0 ? sections : null;
}
