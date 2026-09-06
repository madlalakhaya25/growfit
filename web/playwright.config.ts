import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke test config — see e2e/README.md for what these do and don't cover.
 *
 * No Supabase project is required to run this suite: every test here relies
 * on the app's graceful behaviour when auth fails (redirect to /auth/login,
 * 404 for an unknown token), which works identically against a real project,
 * a paused one, or the placeholder values used in `npm run build` elsewhere
 * in this repo. That's deliberate — it's what lets this run in CI with zero
 * secrets and still catch a broken auth guard.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    // Only set when a pinned Chromium build lives outside Playwright's own
    // cache (e.g. a sandboxed CI image) — normal local/CI runs don't need this.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "dummy",
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://x.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "dummy",
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dummy",
        },
      },
});
