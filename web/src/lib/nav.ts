/**
 * A tab whose own href is a role's bare dashboard root (e.g.
 * "/dashboard/coach") is a *prefix* of every other tab's href in the same
 * role, so it needs an exact match rather than the usual startsWith — the
 * original flat nav in dashboard-shell.tsx had this as a real, live bug:
 * visiting any nested coach route highlighted "Overview" *as well as* the
 * real section, since `pathname.startsWith("/dashboard/coach" + "/")` is
 * true for all of them.
 *
 * Kept in its own module with no other imports, deliberately: it used to
 * live inside dashboard-shell.tsx, but that component also pulls in
 * `AskGrowfitSheet` → `CoachAssistantPanel` → the "use server"
 * coach-assistant action → `@google/genai` (an ESM-only package this
 * project's Jest config doesn't transform) — fine for the app, which
 * bundles that chain through Next's server-action boundary, but it broke
 * the very first unit test that imported dashboard-shell.tsx directly.
 */
export function isActiveHref(pathname: string, href: string, roleRoot: string) {
  if (href === roleRoot) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
