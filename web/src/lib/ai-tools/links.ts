import type { AgentLink } from "./types";

export const MAX_LINKS = 8;

/**
 * Only in-app paths are ever offered as chips. Tool code builds every href
 * itself, so this is a backstop against a future tool bug rather than a
 * defence against the model, which never supplies one.
 */
export function isInternalHref(href: string): boolean {
  return /^\/dashboard\/[A-Za-z0-9/_-]+$/.test(href) && !href.includes("//");
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Picks the links the answer actually drew on, in the order they are first
 * mentioned.
 *
 * Tools return up to `maxRows` rows, so offering a chip per returned row would
 * be a wall of unrelated names. A row counts as cited when its `match` text
 * appears in the answer. A child is often named by first name alone, so the
 * first token of a multi-word match also counts — but only when it is
 * unambiguous among this turn's links, because two players called Sipho must
 * not both light up on one mention.
 */
export function selectCitedLinks(links: readonly AgentLink[], answer: string, max = MAX_LINKS): AgentLink[] {
  const text = norm(answer);

  const firstTokenCount = new Map<string, number>();
  for (const l of links) {
    for (const m of l.match ?? []) {
      const first = norm(m).split(" ")[0];
      firstTokenCount.set(first, (firstTokenCount.get(first) ?? 0) + 1);
    }
  }

  const seen = new Set<string>();
  const scored: { link: AgentLink; at: number }[] = [];
  for (const l of links) {
    if (!isInternalHref(l.href) || seen.has(l.href)) continue;
    seen.add(l.href);
    if (!l.match || l.match.length === 0) {
      scored.push({ link: l, at: Number.MAX_SAFE_INTEGER }); // unconditional: after the cited ones
      continue;
    }
    let at = -1;
    for (const m of l.match) {
      const full = norm(m);
      if (!full) continue;
      const candidates = [full];
      const first = full.split(" ")[0];
      if (first !== full && first.length >= 3 && firstTokenCount.get(first) === 1) candidates.push(first);
      for (const c of candidates) {
        const i = text.indexOf(c);
        if (i !== -1 && (at === -1 || i < at)) at = i;
      }
    }
    if (at !== -1) scored.push({ link: l, at });
  }

  return scored
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map(({ link: { label, href } }) => ({ label, href }));
}
