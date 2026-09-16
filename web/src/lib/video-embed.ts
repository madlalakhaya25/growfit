// Turns a YouTube or Vimeo watch/share URL into an embeddable player URL,
// for the "live transparent overlay" film source (see film-board.tsx).
//
// This source can never produce a still frame — a cross-origin iframe
// exposes no pixels to canvas, by design, so freeze-frame and PNG export
// are impossible for it. That's a browser security boundary, not a bug to
// work around, which is why this source is drawn on top of a *live*,
// playing embed rather than a captured image the way the other two sources
// are.

export type EmbedProvider = "youtube" | "vimeo";

export interface ParsedEmbed {
  provider: EmbedProvider;
  embedUrl: string;
}

/** The only hosts parseEmbedUrl() ever produces. A saved play's `embedUrl`
 * is stored in `tactic_plays.data` (arbitrary JSONB — see
 * app/actions/tactic-plays.ts) and later rendered straight into an
 * `<iframe src>` for whoever opens the play, including players and parents
 * via a share link. Nothing enforces at write time that `embedUrl` was ever
 * produced by parseEmbedUrl() rather than typed/replayed directly, so every
 * render site must re-check the URL is still one of these two hosts before
 * trusting it as an iframe source — never render a stored embedUrl without
 * calling this first. */
const TRUSTED_EMBED_HOSTS = new Set(["www.youtube-nocookie.com", "player.vimeo.com"]);

export function isTrustedEmbedUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && TRUSTED_EMBED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Pure URL parsing — no DOM, so this is unit-tested unlike the
 * canvas-dependent capture helpers in image-capture.ts. */
export function parseEmbedUrl(raw: string): ParsedEmbed | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      const id = url.pathname.split("/")[2];
      return id ? { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    return null;
  }

  if (host === "vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop();
    return id && /^\d+$/.test(id) ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` } : null;
  }

  return null;
}
