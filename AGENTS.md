# Where the app lives

The live app is the Next.js project in `web/` (see `web/AGENTS.md` and
`web/CLAUDE.md`). Database migrations are in `supabase/migrations/`. The
public marketing site is a separate Next.js project in `site/`.

There is no mobile app in this repo. An early Expo shell was removed on
2026-10-13 and is in git history before that date.

# UI work

Before changing what any screen looks like, use the `growfit-ui` skill
(`.claude/skills/growfit-ui/`). To review a screen or a UI pull request, use
`growfit-ux-review`. Screen specs live in `design/screens/`, the visual rules
in `web/STYLE_GUIDE.md`.
