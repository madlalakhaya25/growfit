// Tabs that live in the URL (?tab=register), so the back button and shared
// links work and the page only has to load the open tab's data.

export interface TabDef {
  id: string;
  label: string;
}

/** The tab a `?tab=` value names, or the first tab when it is missing, an
 * array (the param repeated) or not one of ours. */
export function pickTab<T extends TabDef>(tabs: readonly T[], param: string | string[] | undefined): T["id"] {
  const wanted = Array.isArray(param) ? param[0] : param;
  return tabs.find((t) => t.id === wanted)?.id ?? tabs[0].id;
}

/** The link for a tab. The first tab is the page itself, with no query. */
export function tabHref(basePath: string, tabs: readonly TabDef[], id: string): string {
  return id === tabs[0].id ? basePath : `${basePath}?tab=${encodeURIComponent(id)}`;
}
