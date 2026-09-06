@AGENTS.md

# Known gotchas

Things that cost real debugging time this session, kept here so the next
session doesn't rediscover them from scratch.

## Next.js 16 renamed `middleware.ts` to `proxy.ts`

The global auth guard (redirect-to-login for every non-public route,
auth-rate-limiting) lives in `src/proxy.ts`, exporting a function named
`proxy`, not `middleware`. This is a real breaking rename in this Next
version, not a project quirk — see `AGENTS.md`'s warning to check
`node_modules/next/dist/docs/` before assuming an API works like training
data suggests. `PUBLIC_PATHS` in that file is the single source of truth for
which routes skip the auth check; a new top-level public route needs adding
there, not just at the page level (`/offline` was missing from it for a
while, which meant the PWA's own offline fallback page redirected to login
instead of ever showing — silently defeating its purpose).

## Migrations are checked in, not applied

`supabase/migrations/*.sql` are sequentially numbered (`NNN_description.sql`)
files kept in the repo for history and review — nothing in a Claude Code
session applies them. There is no Supabase CLI, no project link, and no
`supabase/config.toml` in this environment. After adding a migration, it
still has to be run against the live Supabase project by hand (SQL editor,
or `supabase db push` from a machine that has the CLI installed and linked)
before the code that depends on it will actually work. Check the latest
existing number before adding a new file.

## Supabase auth degrades gracefully on a fake/unreachable project

`supabase.auth.getUser()` against a placeholder URL like
`https://x.supabase.co` (a real Supabase domain, just no such project)
returns `{ user: null }` rather than throwing — Supabase's shared edge
returns a proper error response even for a nonexistent project, and
`@supabase/ssr` parses that into "no user" instead of an exception. That's
why `npm run build` already runs with dummy env vars elsewhere in this repo,
and why `web/e2e/smoke.spec.ts` can assert "redirects to login" with zero
real secrets. Don't assume this generalises to every Supabase call, though —
only `.auth.getUser()` is verified to behave this way; a `.from(...).select()`
against a fake project is untested and may behave differently.

## Gemini: thinking tokens count against `maxOutputTokens`

Every `generateContent` call in this app is a direct-answer task (suggest an
XI, write 5 drills, summarise a player) with no need for exposed reasoning —
but the model used defaults thinking to automatic, and thinking tokens are
deducted from the same budget as the visible answer. On budgets as tight as
600–1200 tokens, that can consume the whole request before a single word of
the real answer is written, truncating it with no error anywhere — it just
reads as "the AI stopped mid-sentence." Every call now sets
`config.thinkingConfig = { thinkingBudget: 0 }` explicitly. Do the same for
any new AI feature that's answering directly rather than reasoning through
something genuinely multi-step.

## PDF/document internal order is not visual order — match by identity instead

A PDF's resource-dictionary key order and its content-stream paint order were
each tried, independently, as a proxy for "the order these cards appear on
the page" when pairing extracted photos to extracted player rows. Both were
wrong on a real document. Worse than being wrong in general: a single card
with no readable photo shifted every photo after it one player up, so a
name and a wrong child's face silently lined up and looked correct.

The fix that actually held (`src/lib/headshot-matching.ts`): never pair two
independently-extracted lists by position. Match by a field that actually
identifies the record — here, the registration number printed on the same
card as the photo — and leave anything ambiguous for a human rather than
guessing. If a future feature extracts two things from one document that
need to be paired (a signature to a name, a barcode to a row), reach for an
identifying field first; position is a last resort, not a starting point.

## Verify generated visual/binary output by rendering it, not by reading the code

Code that looks obviously correct for drawing a PDF, cropping an image, or
laying out a card produced real, visible bugs that only showed up on
render: `pdf-lib`'s `drawImage` doesn't clip, so a cropped photo bled past
its frame; a QR code silently overlapped a text row; a wrong photo ended up
on the wrong player. Reading the drawing code is not verification — generate
the real artifact and look at it (or, for extraction, extract the real bytes
and view them) before trusting the logic.

Related: when debugging an extraction or parsing bug, get the actual input
file rather than reasoning from a similar-looking sample. Several rounds of
the headshot-matching fix were spent verifying against a sample PDF that
turned out to be a different document than the one actually failing in
production — a fix verified against the wrong input can look completely
correct and still fail on the real one.

## A status enum column is not the same as reality

`fixtures.status` stays `"upcoming"` until a coach manually logs a result —
including for a match that kicked off yesterday. Any UI or query that reads
that column as "has this happened yet" was wrong until it also checked
`fixture_date` against the current time (see `src/lib/fixtures.ts`,
`isFixturePast`). Any other manually-set status column in this schema
(document status, team active flag, etc.) deserves the same suspicion if
it's ever used to answer a date/time-based question.

## Server Actions have a 1MB default body size limit

Raised to `15mb` in `next.config.ts` (`experimental.serverActions.bodySizeLimit`)
because registration PDFs routinely exceed 1MB and were being rejected
before the action even ran — with no error surfaced, just an upload that
hung forever. If a new large-upload feature starts silently failing, check
this first before assuming the bug is in the upload code itself.

## Testing

- `npm test` — Jest + Testing Library, component/unit tests. Existing
  convention: no Supabase/network mocking, tests are pure-logic or
  pure-render. Two pre-existing failures unrelated to any of the above
  (`src/__tests__/validation.test.ts`, `src/components/__tests__/logo.test.tsx`)
  were already failing before this note was written — don't assume a change
  caused them without checking `git blame`.
- `npm run test:e2e` — Playwright smoke tests, see `web/e2e/README.md` for
  exactly what they do and don't cover. They need no Supabase project (see
  the graceful-degradation gotcha above) and are meant to catch "the whole
  app is broken," not to verify a specific feature. Extending them to cover
  a real signed-in flow needs a seeded test project — the README has the
  outline.
- Verify every change with, in order: `npx tsc --noEmit`, `npm test`, and a
  full `npm run build` with dummy env vars (see any recent commit for the
  exact invocation) — the build catches things the type checker and unit
  tests both miss.
