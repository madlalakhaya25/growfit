// Screenshots routes at phone and desktop width, light and dark, for a UI pull request.
// Run against a server that's already up (`npm run dev` or `npm start`):
//
//   npm run ui:shots -- /auth/login /dashboard/coach
//
// Writes web/test-results/ui/<route>/<width>-<theme>.png. Drag them into the PR's UI table.
//
// Signed-in screens need a session. Sign in once in a Playwright browser and save it with
// `npx playwright codegen --save-storage=.auth/coach.json http://localhost:3000/auth/login`,
// then pass it: `UI_SHOTS_STORAGE=.auth/coach.json npm run ui:shots -- /dashboard/coach`.
// Keep .auth/ out of git: it holds a live session.
//
// Options: UI_SHOTS_BASE_URL (default http://localhost:3000), --full-page for the whole scroll height.
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const SIZES = [
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "1280", width: 1280, height: 800, isMobile: false, hasTouch: false },
];
const THEMES = ["light", "dark"];

const args = process.argv.slice(2);
const fullPage = args.includes("--full-page");
const routes = args.filter((a) => a.startsWith("/"));
if (routes.length === 0) {
  console.error("Usage: npm run ui:shots -- <route> [<route> ...] [--full-page]");
  process.exit(1);
}

const baseURL = process.env.UI_SHOTS_BASE_URL ?? "http://localhost:3000";
const storageState = process.env.UI_SHOTS_STORAGE;
const outRoot = new URL("../test-results/ui/", import.meta.url).pathname;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
);
let failed = 0;
try {
  for (const route of routes) {
    const dir = `${outRoot}${route.replace(/^\//, "").replace(/[^\w-]+/g, "_") || "home"}/`;
    mkdirSync(dir, { recursive: true });
    for (const size of SIZES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          baseURL,
          storageState,
          viewport: { width: size.width, height: size.height },
          isMobile: size.isMobile,
          hasTouch: size.hasTouch,
          deviceScaleFactor: 2,
          colorScheme: theme,
        });
        // next-themes reads its choice from localStorage before the system setting.
        await context.addInitScript((t) => {
          try { localStorage.setItem("theme", t); } catch {}
        }, theme);
        const page = await context.newPage();
        const file = `${dir}${size.name}-${theme}.png`;
        try {
          const res = await page.goto(route, { waitUntil: "networkidle" });
          if (res && !res.ok()) console.warn(`${route}: HTTP ${res.status()}`);
          if (new URL(page.url()).pathname !== route) console.warn(`${route}: ended up on ${new URL(page.url()).pathname}`);
          await page.screenshot({ path: file, fullPage });
          console.log(file.replace(outRoot, "test-results/ui/"));
        } catch (err) {
          failed++;
          console.error(`${route} at ${size.name} ${theme}: ${err.message}`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}
process.exit(failed > 0 ? 1 : 0);
