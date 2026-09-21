# Improvement Plan — Tactics, Squad, Player Profile, AI, UI/UX

*Written 2026-09-21, from a read of the 19–21 September commits plus a
verification pass over the code they touched. Every item below cites the file
it came from; nothing here is a guess about what the code probably does.*

Verification run before writing this: `tsc --noEmit` clean, 196/196 Jest tests
pass, `npm ci` clean on `web/`.

---

## Part 1 — What the last two days actually fixed

Nine commits, six of them bug fixes. All six are correctly implemented; I
checked each against the code it changed.

| Commit | Fix | Verdict |
|---|---|---|
| `5c86c93` | Migration `035` — `42P17` infinite recursion in `players` RLS, caused by `032` putting a raw `EXISTS (SELECT … FROM players)` inside a `parent_player_links` policy | Correct. The SECURITY DEFINER helper is the same pattern every other cross-table check already used |
| `947dca5` | `claim_player_profile` verification gap, mobile link-child, error-handling cleanup | Correct |
| `eeb65a0` | Public passport never showed "No ability assessment yet" — `get_public_passport()`'s `avg()` with no `GROUP BY` always returns one all-NULL row, so `attrs ?` was always truthy | Correct, and the root cause is stated precisely |
| `bc5b51f` | Log `player_attributes` query errors on the coach player page | Correct |
| `c5fd3df` | Removed the broken SonarQube workflow and CodeQL's always-failing `deployment_status` trigger | Correct |
| `5c5ec29` | `updateTeam`/`deleteTeam` silently no-opped for an admin who doesn't personally coach the team | Correct. An `UPDATE` matching zero rows is not a PostgREST error, so "no error" was read as success |

### Two patterns worth naming

**1. Six migrations are checked in and (per `web/CLAUDE.md`) not applied.**
`030`, `031`, `032`, `033`, `034`, `035` all ship code that depends on them.
`035` in particular fixes a production error that makes *every* read of
`players` fail. Until these are run against the live Supabase project, the app
is broken in ways no further code change can fix. This is the single highest
priority item in this document and it is not a coding task.

**2. Three of the six fixes were "make a swallowed error visible", and all
three made it visible by writing to `console.error`.**
`web/src/app/(protected)/dashboard/coach/squad/page.tsx:65`,
`…/coach/squad/[playerId]/page.tsx:94`, and the player dashboard all now log to
the Vercel function log. Nobody reads the Vercel function log. The same fix
landing three times in two days says the real gap is that the academy has no
error-reporting surface at all. **Add Sentry (or equivalent) before the next
"silently swallowed" bug**, so the fourth one reports itself.

---

## Part 2 — AI features

The AI layer is the most architecturally interesting part of the app and the
one with the clearest defect.

### AI-1 · The shared squad brief feeds the model invented numbers — fix first

`web/src/app/actions/squad-context.ts:53` selects six columns:

```
player_attributes ( pace, shooting, passing, dribbling, defending, physical )
```

Those six are the original migration `001` columns, and in `001_schema.sql:129`
they are `NOT NULL DEFAULT 50`. The 24 attributes added by `013`/`033` — the
entire tactical, mental and leadership corners, and every goalkeeper attribute
— are not read at all.

Three consequences, all live today:

- A player nobody has assessed is described to the model as
  `pace 50, shooting 50, passing 50, dribbling 50, defending 50, physical 50`.
  The model cannot tell that apart from a genuinely average player. The system
  prompt in `coach-assistant.ts` says *"never invent a rating or a statistic
  that is not in the brief"* — and then the brief invents six per player.
- `physical` is labelled `"Physical (legacy)"` in `lib/attributes.ts:47` with a
  comment saying no position set has ever shown it, so no coach has ever rated
  it. It is always exactly 50, for everyone, and it is in every brief.
- A goalkeeper's four real attributes (`shot_stopping`, `reflexes`, `handling`,
  `distribution`) never reach any squad-aware feature. The AI picks keepers on
  `pace` and `shooting`.

**Fix:** swap the select for `ALL_ATTR_SELECT`, average with the existing
`averageAttributeRows()`, filter to `getPositionAttrKeys(position)`, and print
`unassessed` where there is no value instead of a defaulted 50. All three
helpers already exist in `lib/attributes.ts` and are unit-tested. This is a
~30-line change with a large behavioural payoff.

### AI-2 · Four files read attributes four different ways

| File | Policy |
|---|---|
| `ai-insights.ts:45` | `ALL_ATTR_SELECT`, every coach's row, unaveraged |
| `development-plan.ts:38` | `ALL_ATTR_SELECT`, `.limit(1)` most recently assessed |
| `parent-report.ts:34` | legacy six only |
| `squad-context.ts:53` | legacy six only, then `[0]` — an arbitrary coach's row |

With multiple coaches per team (`team_coaches`, migration `019`) the `[0]` case
is nondeterministic: which coach's assessment the AI sees depends on row order.

**Fix:** one `getPlayerAttributeSnapshot(supabase, playerId)` in
`lib/attributes.ts` that returns the position-filtered average, with the
`isMissingAttributeColumn()` fallback in one place. Four call sites collapse to
one.

### AI-3 · Nothing streams

Every one of the 13 capabilities is a blocking `generateContent` inside a
server action. `generateMatchPlan` asks for 1200 output tokens; the coach
watches a spinner for the whole generation on a touchline phone on mobile data.
`generateContentStream` exists and is a drop-in.

**Fix:** move the three long-form generators (match plan, match report, session
generator) to route handlers that stream, and render progressively. Keep the
short ones as actions.

### AI-4 · The output is a dead end

Every feature returns one prose blob. The prompts go to real trouble to impose
structure — `STARTING XI:`, `BENCH:`, `MUST GET MINUTES:` — and then
`coach-assistant-panel.tsx:151` renders it as `text.split("\n").map(l => <p
className="text-xs text-muted-foreground">)`. So:

- the suggested XI cannot populate the tactics board or the squad selection
- the match plan is not saved to the fixture it was generated for
- the generated session cannot become a training session
- the structure the prompt fought for is thrown away at render

**Fix:** ask Gemini for `responseSchema`-typed JSON *plus* the prose, and add
one **Apply** action per feature — XI → tactics board tokens, session → a real
`training_sessions` row, match plan → saved on the fixture. This is the change
that turns the AI layer from "a thing that writes paragraphs" into "a thing
that does the admin".

### AI-5 · No persistence, no cost ceiling

Nothing generated is stored, so re-reading a match report regenerates and
re-bills it. There is no rate limit on any AI action (`proxy.ts`'s limiter
covers the auth routes only), so any authenticated account can loop them. And
the `catch` blocks return `err instanceof Error ? err.message : …` straight to
the UI, which can surface provider internals.

**Fix:** persist generated artefacts against the row they describe; add a
per-user daily AI call budget; run the catch messages through `friendlyError()`
like every other action already does.

---

## Part 3 — Tactics

The board is a genuinely capable tool. Its problems are ergonomic and
structural, not functional.

### T-1 · The pitch is capped at 448px on every screen — fix first

`tactical-board.tsx:1389`:

```jsx
<div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
  <div className="mx-auto w-full max-w-md">
```

`max-w-md` is 448px, and there is no `lg:` override. A coach on a laptop gets a
phone-width pitch floating in the middle of the `1fr` column with the rest of
the screen empty — on the one screen in the app that is all about spatial
detail. Removing the cap at `lg` and up is a one-line change.

### T-2 · No keyboard shortcuts exist at all

There is no `keydown` listener anywhere in `components/tactics/`. The comment at
`tactical-board.tsx:974` describes Undo as *"Ctrl/Cmd+Z equivalent"* — Ctrl+Z is
not bound to anything. For a drawing tool used at a desk this is the single
biggest speed difference: `Cmd/Ctrl+Z` / `Shift+Z`, `V/R/P/D/F/E` for tools,
`Space` to play, `Delete` to erase the selection, `Esc` to deselect.

### T-3 · Six parallel history arrays kept "in lockstep"

`tactical-board.tsx:270-275` holds `past`/`future` × `state`/`pitch`/`frames` as
six separate refs. `captureSnapshot()` already builds a single
`{ state, pitch, frames }` object — and then `commitSnapshot()` immediately
splits it back into three arrays, and `undo()`/`redo()` pop all three in
parallel. Any future edit path that forgets one of the six desyncs undo
silently.

**Fix:** `past: SnapshotEntry[]`, `future: SnapshotEntry[]`. Two refs, same
behaviour, one place to get it wrong instead of six.

### T-4 · No draft autosave and no unsaved-changes guard

A coach can build a 12-frame animation and lose it by tapping the back button,
or by the phone backgrounding the tab. There is no `beforeunload` handler and
nothing written to `localStorage`.

**Fix:** debounce the board state to `localStorage` per team, offer "restore
your last board?" on mount, and guard navigation while dirty.

### T-5 · 1,971 lines, 27 `useState`, 10 `aria-label`s

The file is the largest in the repo by 3×. `zustand` is already a dependency
(used only by `store/authStore.ts`) and is the natural home for board state.
Most toolbar buttons carry `title` but no accessible name.

**Fix (incremental, not a rewrite):** extract the timeline panel, the save/load
panel and the AI panel into siblings; move board state + history into a
`useBoardStore`. Do this *after* T-1/T-2, which are what a coach actually
feels.

---

## Part 4 — Squad

The squad list is the screen a coach opens most, and it carries the least
information of any screen in the app.

### S-1 · No search, no filter, no sort

`coach/squad/page.tsx:19` accepts exactly one search param: `team`. Players are
grouped by position and that is the whole interaction model. The admin players
page already has search (`admin/players/page.tsx:12`, `AdminPlayerSearch`) — the
coach's own squad doesn't. Across U11 + U13 + U15 that's ~45 players.

**Fix:** reuse the admin search component; add filter chips for "below 75%
attendance", "documents outstanding", "unassessed".

### S-2 · Training attendance is computed but never shown here

The 75% threshold drives the welfare panel and the AI brief
(`lib/attendance.ts`), and the coach picking Sunday's squad cannot see it. Named
in `ROADMAP.md` under Medium term; it belongs at the top of Near term, because
it is the difference between the welfare policy being a report and being a
decision aid.

### S-3 · The card shows the weakest of the two ratings

Each squad card shows `★ {avg}` from match ratings only. The attribute-derived
Overall — the number every *other* surface shows in a `RatingRing` — is absent,
as is any document-compliance or welfare flag.

**Fix:** put Overall, attendance % and a document badge on the card. All three
are already computed elsewhere.

### S-4 · Audit the remaining `getCoachedTeamIds` filters

`5c5ec29` correctly removed the filter from `updateTeam`/`deleteTeam` because it
was scoping, not authorization, and RLS already had it right. The same helper
still wraps `addPlayerToSquad`, `removePlayerFromSquad`, `createPlayer` and the
squad/board/tactics page reads. Some of those are correct; the fix's own
reasoning is the test to apply to each. Worth one deliberate pass rather than
waiting for the next silent no-op.

---

## Part 5 — Player profile

### P-1 · One 546-line page, ten sections, one scroll

`coach/squad/[playerId]/page.tsx` renders, in order: passport card, rating
history + chart, a 30-slider ability assessment, development milestones, parent
access, clips, AI insights, AI development plan, emergency medical info,
registration details, medical form, and the document hub. On a phone, reaching
Documents is a very long scroll past two AI panels.

**Fix:** tabs — **Profile · Assessment · Development · Records** — with the
passport card persistent above them. Everything already exists; this is layout,
not new features.

### P-2 · Two coaches see two different Overalls for the same child

The coach page reads only that coach's own `player_attributes` row
(`[playerId]/page.tsx:69`, `.eq("coach_id", user.id)`), while the player, parent
and admin surfaces average every coach's rows via `averageAttributeRows()`. With
`team_coaches` allowing several coaches per team, the number a coach sees on the
profile is not the number on the child's passport.

**Fix:** show both — "Your assessment" and "Squad average (n coaches)" — rather
than silently picking one. The fact that they differ is useful information.

### P-3 · Assessment is 30 sliders with no context and no history

No comparison against the squad or age-group average, no view of how an
attribute moved across the season, and no fast path — a coach assessing 15
players after training faces 450 slider decisions.

**Fix:** a quick-assess mode (the position's top 5 attributes only), a squad
median tick mark on each slider, and a sparkline per attribute from
`assessed_at` history.

### P-4 · The passport and the internal profile have drifted

`eeb65a0` fixed the public passport's empty-state independently of the internal
one. The two render the same concept from two code paths.

**Fix:** one `<PlayerPassportCard>` shared by the public page, the coach page,
the player dashboard and the parent child page.

---

## Part 6 — UI/UX

### U-1 · The brand colour is still wrong

`globals.css:22` sets `--color-primary: #af2d35`. `ROADMAP.md` records the
academy's actual institutional red as `#A71817`. It has been documented as
wrong and not changed. Two lines (light + dark), and it is the academy's
identity on every screen.

### U-2 · The design pass is scoped and unstarted

`ROADMAP.md` → Medium term already describes this accurately: every card the
same radius, one text size doing every job, red used decoratively rather than
semantically. Nothing in this document supersedes it. Two specifics found while
reading:

- Every `Card` is `rounded-xl` + `shadow-sm` + `border-border`, so a welfare
  alert, a squad card and a document row all have identical visual weight.
- `bg-brand` hairlines sit on top of cards purely as decoration, which spends
  the one colour that should mean *"this needs action"*.

### U-3 · The AI's answer is the faintest text on the screen

`coach-assistant-panel.tsx:151` and `:184`: the model's reply — the thing the
coach asked for — renders as `text-xs text-muted-foreground`, while the coach's
own question renders as high-contrast `bg-primary text-primary-foreground`. The
hierarchy is inverted. Fixing this is CSS, and it is the highest
perceived-quality-per-line change in the app.

### U-4 · No error reporting

See Part 1. Three `console.error`s in two days into a log nobody reads.

### U-5 · i18n

Unchanged from `ROADMAP.md`: no library, ~60 pages of hardcoded English, in an
academy in Greater Durban. Not this cycle; the cost rises every month it waits.

---

## Sequencing

**Step 0 — not code.** Apply migrations `030`–`035` to the live Supabase
project. Nothing below matters until `035` is applied; without it every read of
`players` fails.

**Then, in order.** Ordered by value per unit of effort, not by area:

| # | Item | Area | Size | Status |
|---|---|---|---|---|
| 1 | Remove the fixed pitch cap | T-1 | 1 line | **Done** |
| 2 | Real brand red `#A71817` | U-1 | 2 lines | **Done** |
| 3 | AI answer typography | U-3 | CSS | **Done** |
| 4 | Squad brief reads all 30 attributes; never print a defaulted 50 | AI-1 | ~30 lines | **Done** |
| 5 | Keyboard shortcuts on the board | T-2 | small | **Done** |
| 6 | Error reporting (Sentry) | U-4 | setup | Not started — needs an account and a DSN |
| 7 | `getPlayerAttributeSnapshot()` — one attribute-read policy | AI-2 | refactor | **Done** (as `buildAttributeSnapshot`) |
| 8 | Squad search + filter chips | S-1 | small | **Done** |
| 9 | Attendance %, Overall and doc badge on the squad card | S-2/S-3 | small | **Done** |
| 10 | Board draft autosave + unsaved-changes guard | T-4 | small | **Done** |
| 11 | Tabs on the player profile | P-1 | medium | **Done** |
| 12 | Collapse the six history refs to two | T-3 | medium | **Done** |
| 13 | Show both "your assessment" and "squad average" | P-2 | small | **Done** |
| 14 | Structured AI output + one **Apply** action per feature | AI-4 | large | Not started |
| 15 | Stream the three long generators | AI-3 | medium | Not started |
| 16 | Persist AI artefacts; AI rate limit; friendly AI errors | AI-5 | medium | **Partly done** — errors and rate limit shipped; persistence needs a migration |
| 17 | Quick-assess mode + squad median marks | P-3 | medium | Not started |
| 18 | Shared `<PlayerPassportCard>` | P-4 | medium | Not started |
| 19 | Board state → zustand, extract panels | T-5 | large | Not started |
| 20 | The full design pass | U-2 | large | Not started |
| — | S-4: audit the remaining `getCoachedTeamIds` filters | S-4 | medium | Not started |

## What was deliberately not done, and why

- **6 · Sentry.** Needs an account, a DSN and a decision about where errors
  go. No code change can stand in for that. Until it exists, the three
  `console.error` calls from the 19–21 September fixes still go to a log
  nobody reads — this remains the highest-value item on the list.
- **14 · Structured AI output and Apply actions.** The largest item here and
  the one that changes what the AI layer *is*. It needs product decisions
  first: what an applied XI does to an existing squad selection, whether a
  generated session lands as a draft or a real row, what happens when a
  coach edits after applying. Worth doing; not worth guessing at.
- **15 · Streaming.** Means moving three generators from Server Actions to
  route handlers and reworking their panels. Defensible, but it is a
  refactor of working code for a latency win, and it sits behind 14 — if the
  output becomes structured, the streaming surface changes anyway.
- **16 (persistence).** Saving a generated match plan against its fixture
  needs a new table, and migrations in this repo are checked in but not
  applied. Adding a migration nobody can run would make the backlog of
  unapplied migrations worse, not better.
- **17, 18, 19, 20.** Real improvements, none of them blocking. 19 and 20 in
  particular are large enough to deserve their own passes: the board
  refactor wants a test suite around the board first, and the design pass
  needs the three-direction proposal the roadmap refers to, which is not in
  this repo.
- **i18n (U-5).** Unchanged from the roadmap: long term, and every month it
  waits costs more.

Items 1–5, 7–13 and the safe half of 16 shipped on
`claude/bug-review-feature-planning-djy3ba`. Verification for the whole set:
`tsc --noEmit` clean, 219/219 Jest tests (23 new), production build
succeeds, and eslint gained no new findings.
