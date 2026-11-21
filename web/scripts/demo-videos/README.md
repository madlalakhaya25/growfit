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

## Put them on the site

Copy the finished MP4s from `web/demo-videos/out/` into `site/public/demo/`
(same file names). The "See it in action" section on the marketing site lists
whichever clips are there and hides itself when there are none. Titles, order
and blurbs live in `site/src/lib/demo-clips.ts`.


## The themed videos (what you publish)

`npm run demo:videos` builds the videos in `videos.mjs`, each 45-70 seconds: a title card, recorded scenes
cross-faded together, and the Growfit end card. Phone scenes sit in a branded 16:9 frame with a one-line note.

    npm run demo:videos                  # all six, then the opening video
    npm run demo:videos -- 03            # one video (by id prefix)
    npm run demo:videos -- 00            # the opening video, cut from the finished six (build them first)
    npm run demo:videos -- --clips       # one MP4 per scene, no stitching

Scene ids that start `v1-` ... `v6-` are the segments of video 1 ... 6. Edit captions and pacing in `scenes.mjs`,
and the titles and order in `videos.mjs`.

### Scripted AI (read before you call a clip "live AI")

The AI scenes record against `mock-gemini.mjs`, a stand-in for Gemini. The app is real; only the model's wording is
scripted, and it is written against the demo data. Run it and point the app at it:

    node scripts/demo-videos/mock-gemini.mjs &
    GOOGLE_GEMINI_BASE_URL=http://localhost:4010 GEMINI_API_KEY=demo npm start

### Before each take

Run `supabase/seed_demo_reset.sql` on the demo project. The clips tick boxes, mark the register and cache AI answers,
so a second take would otherwise start from a different screen. Its DELETEs ask for confirmation in the Supabase
connector. Everything else (`seed_demo.sql`) is safe to re-run and moves the dates to be relative to today.

### Known limits of the demo data

* The demo sessions and team use hand-made ids that are not RFC UUIDs, so two actions reject them: "Apply to this
  session" (drills) and "Post announcement". The clips avoid both. Real data has real UUIDs.
* The demo academy has one team (U13), so the curriculum coverage card reads 0% for U11 and U15.
* In a cloud container, the Next server needs `NODE_USE_ENV_PROXY=1` to reach Supabase through the egress proxy.


## Voiceover (Leah)

Leah is the Microsoft Edge neural voice, English (South Africa), set slightly slower: the same voice as the
Botlhale demos (see the Vela UI v2 demos README). What she says is in `narration.mjs`, one line per segment, written
naturally (the recorder spells out "AI", "3D", "CSV" and "75%" for the voice, so subtitles stay clean).

    python3 -m venv .venv && .venv/bin/pip install edge-tts
    DEMO_EDGE_TTS=.venv/bin/edge-tts npm run demo:videos -- --voice            # record, narrate, stitch
    DEMO_EDGE_TTS=.venv/bin/edge-tts npm run demo:videos -- --voice --reuse    # skip recording; just redo the voice

`--voice` writes, for each video in `web/demo-videos/out/`:

* `<id>.mp4`: with Leah, a built-in subtitle track and one chapter per segment
* `<id>-silent.mp4`: the same video with no audio (the highlights video is cut from these)
* `<id>.srt`: subtitles timed to Leah's own sentence timing

`--reuse` keeps the recorded segments (`demo-videos/.segments`) and synthesised lines (`demo-videos/.voice`), so
changing a narration line costs seconds, not a re-record. If a line runs longer than its segment, the last frame is held.

Options: `DEMO_VOICE` (default `en-ZA-LeahNeural`), `DEMO_VOICE_RATE` (default `-8%`).

In a cloud container the service address `speech.platform.bing.com` must be on the network allowlist, and
`edge-tts` is run through the proxy (`--proxy $HTTPS_PROXY`, passed automatically).

Note: `edge-tts` uses the Edge browser's read-aloud service, which is free but unofficial. The same voices are
available, licensed, through Azure AI Speech (`en-ZA-LeahNeural`) if the videos ever need a supported service.
