# Demo videos

Short captioned clips of the real app for marketing: one MP4 per scene, 1080p
(vertical 1080x2336 for phone scenes), with a Growfit end card.

## Make them

1. Use a **throwaway Supabase project loaded with `supabase/seed.sql`**
   (fictional academy, no real children). Never record against production:
   published footage of real names or photos is a POPIA problem.
2. Put that project's URL and anon key in `web/.env.local`, then
   `npm run build && npm start` (a production build has no Next.js dev badge and
   is smoother on camera). Set `GEMINI_API_KEY` if a scene shows an AI feature.
3. `npm run demo:videos` for every scene, or name some:
   `npm run demo:videos -- 03-match-day 05-parent-view`
4. Clips land in `web/demo-videos/out/` (git-ignored).

`npm run demo:videos -- --smoke` records the public login page only. Use it to
check ffmpeg and the browser work before you have a seeded project.

Env: `DEMO_BASE_URL` (default `http://localhost:3000`), `DEMO_PASSWORD`
(default is the seed's), `PLAYWRIGHT_CHROMIUM_PATH` if your Chromium lives
outside Playwright's cache. Needs `ffmpeg` on PATH.

## Change what they show

Edit `scenes.mjs`: routes, captions, scroll, a click target, how long to hold.
Write captions as the benefit to a coach or parent, not as a UI description.
Re-run after any UI change and the clips stay current.

Check each clip by eye before publishing: the seed has only ten players and
two sessions, so a screen can look sparse. Add rows to the seed rather than
faking footage.
