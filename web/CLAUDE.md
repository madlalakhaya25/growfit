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

This has already bitten once in production: migration `013` (the 19 expanded
player attributes) was never run, so saving a coach assessment failed with
`Could not find the 'agility' column of 'player_attributes' in the schema
cache` — PostgREST's `PGRST204`. The same message appears for a *different*
cause: the columns exist, but PostgREST is still serving a schema cache from
before they were added. `NOTIFY pgrst, 'reload schema';` is the fix for that
second case and is a no-op for the first, so
`030_repair_expanded_attributes.sql` does both and is safe to re-run.

Two lessons worth generalising. **A column added by a later migration is
optional at runtime, not guaranteed** — `src/lib/attributes.ts` splits the
attribute keys into `CORE_ATTR_KEYS` (migration 001, always there) and
`EXTENDED_ATTR_KEYS` (013, may not be), and both the write path and the wide
reads fall back to the core six via `isMissingAttributeColumn()` rather than
failing whole. And **a wide `SELECT` naming a missing column fails outright
rather than returning the columns that do exist** (`42703`), which reads as
"this player has no assessment" instead of as an error — silently wrong, not
visibly broken. Prefer a shared select-list constant over a copy-pasted
column string so the fallback only has to be written once.

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

Code that looks obviously correct for drawing a PDF, cropping an image, or laying out a card produced real, visible bugs that only showed up on
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

## A Server Action's `{ error } | { success }` return type only type-checks against fresh literals

Every mutating Server Action here returns `{ error: string }` on failure or
`{ success: true }` on success, and every caller reads it as `if (res?.error)
toast.error(res.error)`. That pattern only type-checks because *every* branch
returns a fresh object literal (`return { error: "..." };`) — TypeScript's
return-type inference from several literal returns lets a caller read a
property that exists on only some of the union's members, but only while
every branch stays a literal. Swap even one branch to `return
SOME_SHARED_CONSTANT;` (e.g. hoisting a repeated `"Fixture not found."`
message into a module-level `const` to please a linter) and the *caller's*
`res.error` access starts failing with `TS2339: Property 'error' does not
exist on type '{ success: boolean }'` — same structural type, different
result, because the constant reference breaks the literal-only inference
path. Never hoist a Server Action's per-branch return literal into a shared
constant; duplicate the string instead.

This one also exposed that `npx tsc --noEmit` in this environment is
**incremental** (`tsconfig.tsbuildinfo`, gitignored) and can fail to
re-surface a real cross-file error it already knows about after a
same-directory edit — it took `rm tsconfig.tsbuildinfo` to get an honest
result. If a change touches a function's inferred return type and something
about the result feels too clean, delete that file before re-running `tsc`.
CI's fresh checkout doesn't have this problem; a local "clean" run might.

## Server Actions have a 1MB default body size limit

Raised to `15mb` in `next.config.ts` (`experimental.serverActions.bodySizeLimit`)
because registration PDFs routinely exceed 1MB and were being rejected
before the action even ran — with no error surfaced, just an upload that
hung forever. If a new large-upload feature starts silently failing, check
this first before assuming the bug is in the upload code itself.

## A missing TABLE is a different error from a missing COLUMN

`isMissingAttributeColumn()` catches `PGRST204` / `42703` -- the *column* codes.
A migration that creates a whole **table** fails differently: PostgREST `PGRST205`,
Postgres `42P01`. The column helper does not fire for those, so reusing it for a
new table turns a not-yet-applied migration into a hard failure on a coach's
screen. `lib/ai-artefacts.ts` has the table-specific helper
(`isMissingAiArtefactsTable`); `friendlyError()` recognises both pairs. The
contract for a new table: reads return `available: false` (not an error) when it
is absent, and the caller falls through to today's behaviour -- the UI loses
persistence, not function.

## `profiles` is invisible to a player or parent -- and the join returns null silently

`profiles` RLS lets a player or parent read only their **own** row. A nested join
to resolve another person's name (the coach who signed a milestone off, who
approved a plan) therefore comes back `null` on exactly the surfaces that need it,
with no error -- and reads as "nobody did this". Either denormalise the name at
write time (`ai_artefacts.approved_by_name`) or render a fallback such as "your
coach" -- never an empty string. `lib/development-data.ts` resolves names only for
staff and returns `completedByName: null` everywhere else.

## RLS is row-level, not column-level: a private field needs its own row

You cannot let a player `SELECT` a row and hide one column of it; whatever the UI
omits, the row still carries it in the RSC payload. The development plan keeps the
coach's private note and the verdict on the previous plan in a `'development_plan'`
row, and writes a **second** `'development_plan_shared'` row holding only
`toPlayerSafePlan()`'s output (a distinct type, built field by field). Migration
045's policies admit a player or parent to the second kind only, and only once
approved. The same applies to any future "coach sees more than the child" data.

## AI cache keys: the brief must be deterministic, and must not contain its own output

`lib/ai-artefacts.ts` serves a stored answer when `sha256(brief)` is unchanged.
Three ways that silently never hit, all of which only show up as a bill:

- **Unstable brief.** An unsorted `.select()`, a `Map`/object iterated in arrival
  order, a tie with no tie-break, a timestamp in the text. Sort every collection
  inside the builder and break ties on a stable field.
- **A moving window.** "The last 90 days" changes daily; bucket its start to a
  fixed boundary (`bucketedAttendanceStart`) or the key changes with no new data.
- **Fingerprinting the previous answer.** The development-plan brief includes the
  previous plan, so a key over the *whole* brief changes every time a plan is
  generated and can never hit. The key is over the world-state part only
  (`worldBrief`); the previous plan is shown to the model but is not in the key.

## Testing an action without Supabase

`src/test-utils/fake-supabase.ts` is a chainable, thenable stand-in whose handler
sees `{ table, action, payload, one }` and returns what that call should resolve
to. Use it for the decisions an action makes (who is let in, when the model is and
isn't called, what is written); prove RLS against a real PostgreSQL instead
(`docs/MIGRATION_RUNBOOK.md`, "Reproducing this verification"). Mock only the
Gemini SDK (its ESM build can't load under Jest), `next/cache`, and the auth seam
(`requireStaff` / `coachesPlayer`, whose logic `auth-guards.test.ts` covers).
Mutate the code once to confirm a new test can actually fail.

## Testing

- `npm test` — Jest + Testing Library, component/unit tests. Existing
  convention: no network mocking; tests are pure-logic or pure-render, plus the
  action-level tests described above. As of 2026-10-01 the whole suite passes
  (the two failures older notes mention, `validation.test.ts` and `logo.test.tsx`,
  no longer fail) -- so a red test is yours.
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

## CI now actually runs the above on every PR

`.github/workflows/pr-checks.yml` runs `tsc`, `npm test`, `npm run build`,
and the Playwright suite on every PR to `main` — this used to be nothing but
SonarQube and CodeQL, neither of which catches a broken build. CodeQL
(`codeql.yml`) now runs on push to `main` and a weekly cron only, not on
every PR — it was redundant to run twice for the same commit once it also
runs on push. The `pr-agent.yml` Gemini-review workflow was removed
entirely: it was advisory only and had become more failure than signal
("Failed to review PR" on most recent runs). Branch protection isn't turned
on yet, so none of this blocks a merge as of this note — that's a
deliberate separate step, not an oversight.

## The Growfit Agent streams from a Route Handler, not a Server Action

`app/api/agent/route.ts` is the one place the app departs from "everything is
a Server Action": a Server Action returns once and cannot stream tokens, and
the agent's tool rounds make the wait long enough that streaming matters. The
loop itself (`lib/ai-tools/run-loop.ts`) has no Next, Supabase or SDK imports —
the route injects them — so it is unit-tested with a stubbed model.

Three things that are easy to get wrong:

- **`proxy.ts` does not guard `/api`.** Its `isPublic` check treats the whole
  `/api` prefix as public, so a new route there is unauthenticated unless it
  checks for itself. `/api/agent` does (`401` on POST, `requireUser()` redirect
  on GET); do the same for any new route.
- **`thinkingBudget: 0` is relaxed here, and only here** (512). Every other call
  is a direct-answer task; this one is genuinely multi-step. Thinking tokens
  still come out of `maxOutputTokens`, so the ceiling (1800) sits well above
  the budget. A truncated answer has no error — it just stops mid-sentence.
- **Replay the model's own `Part`s** when feeding tool results back. Gemini 3
  expects the `thoughtSignature` on a function-call part to come back with it;
  rebuilding the part from `{ name, args }` drops it.

Budget (`checkAiBudget`) is consumed once per user turn, not per tool round.
