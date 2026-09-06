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

## PR Agent review pipeline (new PR pipeline) — gotcha

The repository now includes an automated PR reviewer job (`.github/workflows/pr-agent.yml`) that runs two independent models (Qwen2.5-Coder via OpenRouter and Gemini) using the `pr-agent` CLI. This job is advisory (not the merge gate) and has a few operational behaviours and pitfalls that have caused confusion and failed runs in the past:

- Dual-model runs and secrets:
  - The job runs two parallel review jobs (qwen-review and gemini-review). Each only runs if the PR is not a draft and the relevant secret is present.
  - Qwen requires `OPENROUTER_API_KEY`; Gemini requires `GEMINI_API_KEY`.
  - If a secret is missing the workflow prints a warning and skips that reviewer. A skipped reviewer is normal when a key isn't set; it's not a failure but it means you'll only get the other review (or none).
  - Gemini in this repo reuses the same `GEMINI_API_KEY` as the app's runtime features — consider giving CI its own key to avoid using up production quota or mixing billing.

- pr-agent CLI nuances:
  - The workflow installs `pr-agent` via `pip install pr-agent` and runs the CLI directly. That means the runner needs a compatible Python version (the job requests 3.12) and a working pip build environment.
  - pip install can fail for transient network reasons or if `pr-agent`'s upstream release has binary deps needing system libs. If `pip install pr-agent` fails, try:
    - Adding a step to upgrade pip/setuptools/wheel: `python -m pip install --upgrade pip setuptools wheel`.
    - Pinning to a known-good `pr-agent` version: `pip install pr-agent==<version>`.
    - Installing missing system packages with `apt-get` if the error mentions missing headers.

- Model slugs and "model not found" errors:
  - The Qwen model is invoked with the OpenRouter slug `openrouter/qwen/qwen-2.5-coder-32b-instruct:free` in the workflow. That slug is hosted by OpenRouter's free tier and is subject to change or removal by OpenRouter. If logs show "model not found" for Qwen, check openrouter.ai and swap to a current slug.
  - Gemini errors usually come from invalid keys or quota; check the exact CLI output in the job logs for the HTTP error code and request id.

- Permissions and tokens for posting comments:
  - The jobs require `pull-requests: write` and `issues: write` to post review comments. The workflow already declares these permissions, but an org policy or repo settings can still block bot comments — verify in repo settings and audit logs if posts silently fail.
  - The CLI uses `GITHUB_TOKEN` (provided by Actions by default). If you want the agent to act as a named bot account instead, create a PAT and store it as a secret and pass it to the workflow, but be cautious with extra permissions.

- Skipped steps vs failures:
  - The workflow deliberately emits warnings when keys are missing and then skips the heavy reviewer steps. That looks like a problem in the UI unless you read the step output — treat a "skipped" step with a warning as expected unless you intended the reviewer to run.

- Diagnostic hardening to add if you see flaky failures:
  - Echo Python/pip versions before install:
    ```bash
    python --version
    pip --version
    which python
    ```
  - Upgrade pip and pin pr-agent.
  - Add `set -x` to the runner step to capture expanded env and arguments in logs (be careful not to print secrets).
  - If the pr-agent CLI reports an HTTP auth error, paste that exact log into an issue or support request — it contains the provider response.

- Interaction with the required PR gate:
  - This PR Agent job is advisory only — `pr-checks.yml` is the repository's required gate that runs tsc, jest, build, and Playwright. Don't rely on the PR Agent comment threads to block merges; keep `pr-checks.yml` as the enforced check.

If you hit a failing run, copy the job URL or failing step logs and paste them here and the exact step will be diagnosed. If you'd like, I can also add a short diagnostic step to the workflow (pip upgrade + echo versions) and pin `pr-agent` in the workflow for more stable CI runs.

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
