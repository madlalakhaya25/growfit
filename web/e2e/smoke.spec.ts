import { test, expect } from "@playwright/test";

/**
 * Smoke tests — see e2e/README.md for scope and how to extend this.
 *
 * These exist to catch the "the whole app is broken" class of regression
 * before a user does: a route 500ing, the auth guard silently letting
 * someone through (or blocking someone it shouldn't), a page that used to
 * render now throwing. They are not feature tests — nothing here logs in as
 * a real coach or parent, because that needs a seeded Supabase project this
 * suite deliberately doesn't require. See e2e/README.md for what a fuller
 * suite would need and where to add it.
 */

test.describe("public pages render", () => {
  for (const path of ["/", "/auth/login", "/auth/register", "/auth/forgot-password", "/offline", "/register-club"]) {
    test(`${path} responds 200`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
    });
  }
});

test.describe("the auth guard blocks every dashboard without a session", () => {
  // One entry per role, plus a couple of deeper routes — a regression here
  // usually means the guard logic changed (proxy.ts, or the protected
  // layout's own check) rather than one specific page.
  const protectedPaths = [
    "/dashboard",
    "/dashboard/admin",
    "/dashboard/admin/players",
    "/dashboard/coach",
    "/dashboard/coach/fixtures",
    "/dashboard/parent",
    "/dashboard/player",
  ];

  for (const path of protectedPaths) {
    test(`${path} redirects an anonymous visitor to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  }
});

test.describe("routes that key off an external token fail closed, not broken", () => {
  test("an unknown player passport token 404s rather than crashing", async ({ page }) => {
    const response = await page.goto("/passport/this-token-does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("an unknown invite code sends an anonymous visitor to login, not a crash", async ({ page }) => {
    await page.goto("/join/this-code-does-not-exist");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("the login redirect preserves where the visitor was headed", async ({ page }) => {
    // Regression coverage for a real bug: the proxy used to redirect to a
    // bare /auth/login with no way back, so a logged-out visitor following
    // a team invite link lost the invite code the moment they had to sign in.
    await page.goto("/join/this-code-does-not-exist");
    await expect(page).toHaveURL(/next=%2Fjoin%2Fthis-code-does-not-exist/);
  });
});
