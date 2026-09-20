import Link from "next/link";

/**
 * Renders plain text with links made tappable.
 *
 * Announcement bodies are stored as plain text, so a shared tactics link
 * (/dashboard/player/tactics/<token>) used to render as unclickable text —
 * leaving the play unreachable on a phone. This turns internal paths into real
 * links and external URLs into safe new-tab links, without allowing arbitrary
 * HTML into the page.
 */
const TOKEN = /(https?:\/\/[^\s]+|\/dashboard\/[^\s]+)/g;

export function LinkifiedText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (!part) return null;

        // Internal app route — client-side navigation.
        if (part.startsWith("/dashboard/")) {
          const clean = part.replace(/[.,)]+$/, "");
          const trailing = part.slice(clean.length);
          return (
            <span key={i}>
              <Link href={clean} className="text-primary underline underline-offset-2 break-words">
                {clean}
              </Link>
              {trailing}
            </span>
          );
        }

        if (/^https?:\/\//.test(part)) {
          const clean = part.replace(/[.,)]+$/, "");
          const trailing = part.slice(clean.length);
          return (
            <span key={i}>
              <a
                href={clean}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 break-words"
              >
                {clean}
              </a>
              {trailing}
            </span>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
