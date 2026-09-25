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

/**
 * A second real bug in the same family: `Array.prototype.find`/`.some`
 * treat every matching href as equally active, so whichever one happens
 * to come first in the list wins — not the one that actually describes
 * the current page best. `/dashboard/admin/players/documents` is a prefix
 * match against People's "Players" tab (`/dashboard/admin/players`) *and*
 * an exact match against Compliance's "Documents" tab
 * (`/dashboard/admin/players/documents`); People happens to be listed
 * first, so it used to win even though Documents is the actual page.
 * Same shape for `/dashboard/coach/squad/emergency` against Squad's own
 * "Players" and "Emergency" tabs — both matched, both rendered active.
 *
 * Picks the single longest matching href instead, so a more specific
 * (exact, or longer-prefix) match always beats a shorter one. `roleRoot`
 * is optional: `SectionTabs` sub-tabs are never a role's bare root, so
 * they use plain prefix/exact matching with no special case.
 */
export function pickLongestActiveHref(
  pathname: string,
  hrefs: string[],
  roleRoot?: string
): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches =
      roleRoot !== undefined
        ? isActiveHref(pathname, href, roleRoot)
        : pathname === href || pathname.startsWith(href + "/");
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}
