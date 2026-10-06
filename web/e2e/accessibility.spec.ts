import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Accessibility scan (docs/FEATURE_SPECS/experience-quality.md, step 4) of every
 * screen a signed-out visitor can reach, on a phone-sized screen and in both
 * colour schemes. Serious and critical axe findings fail the run; lesser ones
 * are listed in the output so they can be worked down.
 *
 * Signed-in screens (the ones coaches and parents use most) are not scanned
 * here: that needs a seeded test project, which does not exist yet.
 */
const PAGES = ["/", "/auth/login", "/auth/register", "/auth/forgot-password", "/offline", "/register-club"];

test.use({ viewport: { width: 390, height: 844 } });

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`axe, ${colorScheme} mode`, () => {
    test.use({ colorScheme });
    for (const path of PAGES) {
      test(`${path} has no serious or critical issues`, async ({ page }) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        const minor = violations.filter((v) => !blocking.includes(v));
        for (const v of minor) console.log(`[${path}] ${v.impact}: ${v.id} (${v.nodes.length}) ${v.help}`);
        expect(
          blocking.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })),
        ).toEqual([]);
      });
    }
  });
}
