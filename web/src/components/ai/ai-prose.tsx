import { cn } from "@/lib/utils";

/**
 * Renders an AI answer as readable prose.
 *
 * Every AI feature in the app returns plain text with a deliberate structure
 * the prompt asks for — `STARTING XI:`, `BENCH:`, `1. SQUAD HEALTH:`,
 * `THE PLAN IN A SENTENCE:` — and until this existed, nine call sites each
 * re-implemented the rendering, badly and differently:
 *
 *  - The coach assistant (the most-used one) rendered the model's answer as
 *    `text-xs text-muted-foreground` — the faintest, smallest text on the
 *    page — while rendering the coach's *own question* in high-contrast
 *    `bg-primary text-primary-foreground`. The hierarchy was inverted: the
 *    thing the coach asked for was the hardest thing to read.
 *  - The panels that did style headers used
 *    `/^\d+\.\s+[A-Z][A-Z\s]+:/`, which only matches *numbered* headers. The
 *    assistant's own formats (`SHAPE:`, `BENCH:`) are unnumbered, so they
 *    never matched anywhere and rendered as undifferentiated grey.
 *
 * The answer is body copy, so it is `text-sm text-foreground`. Only the
 * structural labels are de-emphasised into small caps — they are signposts,
 * not the content.
 */

/**
 * A structural label the prompts produce: an optional leading number, then
 * two or more characters of caps/digits/punctuation, then a colon.
 *
 * Deliberately requires the colon and at least two leading characters, so an
 * ordinary sentence that happens to start with an acronym ("SAFA registration
 * is due") is not mistaken for a heading.
 */
const LABEL_RE = /^\s*(?:\d+\.\s*)?([A-Z][A-Z0-9 &/'()\-]{1,}?):\s*(.*)$/;

/** A bullet the prompts produce, either `- x` or `1. x`. */
const BULLET_RE = /^\s*(?:[-•*]|\d+[.)])\s+(.*)$/;

export function AiProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split("\n").map((l) => l.trimEnd());

  return (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" aria-hidden="true" />;

        const label = LABEL_RE.exec(line);
        if (label) {
          const [, head, rest] = label;
          // `HEADING:` alone on its line is a section break; `LABEL: value`
          // is one field, and splitting it onto two lines would waste a lot
          // of vertical space on a phone for no gain.
          return rest ? (
            <p key={i} className="pt-2 first:pt-0">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {head}:{" "}
              </span>
              {rest}
            </p>
          ) : (
            <p
              key={i}
              className="pt-3 first:pt-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {head}
            </p>
          );
        }

        const bullet = BULLET_RE.exec(line);
        if (bullet) {
          return (
            <p key={i} className="flex gap-2 pl-0.5">
              <span aria-hidden="true" className="select-none text-muted-foreground">
                •
              </span>
              <span className="flex-1">{bullet[1]}</span>
            </p>
          );
        }

        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}
