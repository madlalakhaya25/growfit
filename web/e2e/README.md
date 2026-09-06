# Smoke tests

Run with `npm run test:e2e` (starts its own dev server; add `PLAYWRIGHT_BASE_URL`
to point at one already running, e.g. a preview deploy).

## What's actually covered

Every test here runs with **no Supabase project and no seeded data** — it
relies on the app's own graceful failure behaviour (redirect to login, 404 for
an unknown token) which works the same against a real project, a paused one,
or placeholder values. That's what makes this safe to run in CI with zero
secrets, and it's exactly how `npm run build` is already run elsewhere in this
repo.

What it catches: a route 500ing that used to render, the auth guard
(`src/proxy.ts` or the `(protected)` layout) silently changing behaviour, a
page crashing instead of 404ing. That's a real, if narrow, safety net — it's
how the `/offline` page's own auth-guard bug was found (it wasn't in the
proxy's public-path allowlist, so it redirected to login instead of ever
showing offline — fixed alongside adding this suite).

## What's NOT covered, on purpose

Nothing here logs in as a coach, admin, parent, or player, and nothing
touches real data. The flows that actually break in production — attendance
marking under a bad connection, a PDF import misattributing a photo, a
fixture's status drifting from its date — all need a signed-in user with a
real squad behind them, which needs a seeded Supabase test project this
repo doesn't have checked in.

To extend this properly:

1. Stand up a Supabase project (or a local one via the Supabase CLI) seeded
   with one academy, one admin, one coach, one parent, one player, and a
   small squad — a `supabase/seed.sql` alongside the existing
   `supabase/migrations/` would do it.
2. Add a Playwright `storageState` per role (log in once via the UI or the
   `/api` layer, save the session, reuse it — see Playwright's
   [authentication docs](https://playwright.dev/docs/auth)).
3. Write one spec per critical job, matching the flows already identified as
   fragile: mark attendance and confirm it survives a reload, upload a
   registration PDF and confirm each photo lands on the right player, cancel
   a fixture and confirm the reason shows to a parent.

Until that seed project exists, treat a failure in this suite as "something
is broken for everyone," and treat a *pass* as exactly that — not as
confirmation any real feature still works.
