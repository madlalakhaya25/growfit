# AI depth and UX plan — 2026

*Written 2026-10-01. Supersedes nothing; extends `AI_FEATURES_AND_IA.md`
(2026-09-24) with the tactics/video/performance leaders that scan didn't
reach, and with what changed in the market since.*

**Status: Parts 1–3 are a proposal for agreement. Parts 4–5 are an
implementation spec and are ready to build.** Phase 0 is a live defect and
ships regardless of whether the rest is agreed.

> **Implementation status (2026-10-01).** Phase 0 and Phase 1 steps 1.1-1.6, 1.8
> and 1.9 are built and pushed on `claude/gracious-brown-lz6zo7`, one commit per
> step. **1.7 is held** on the human check this document specifies. Two things in
> the spec were wrong and are corrected in the code: the cache key must not
> include the previous plan (it could never hit), and the attendance bucketing as
> written was off by a day-of-month and, for Feb-May, 89 days. See
> `BACKLOG.md` Phase 6 for the table, deviations and what is still outstanding.
> Phases 2-5 have no implementation spec yet.

---

## How to use this document

**If you are an implementing session, read this section fully before touching
code.**

Read in this order: `web/CLAUDE.md` (gotchas — they cost real debugging time
and several are repeated below where they bite), `docs/BACKLOG.md` Phase 3–5
(what is already shipped; do not re-plan it), then Part 4 of this document.

### Hard rules

1. **One PR per numbered step.** Every step in Part 4 is sized to be reviewable
   alone and lists its own acceptance criteria. Do not combine steps.
2. **Run the full verification loop on every step**, in the order given in
   Part 6. A third Jest failure means you caused it — the baseline is exactly
   two.
3. **Never hoist a Server Action's per-branch return literal into a shared
   constant.** `web/CLAUDE.md` documents why: the `{ error } | { success }`
   union only type-checks while every branch returns a fresh object literal,
   and breaking it fails at the *caller*, not the action. Prefer the explicit
   all-optional annotation (`Promise<{ plan?: string; error?: string }>`) that
   `saveMatchPlan` already uses, **and** keep the literals. Both, not either.
4. **`rm -f web/tsconfig.tsbuildinfo` before `tsc`** on any step that changes a
   Server Action's signature or inferred return type. The incremental cache
   silently hides real cross-file errors.
5. **Migrations are checked in, never applied by a session.** There is no
   Supabase CLI or project link here. Every read of a new table or column must
   degrade to today's behaviour, not to an error. See step 1.1's note on
   missing-*table* vs missing-*column* error codes — they are different and
   the existing helper catches only the latter.
6. **Do not commit AI attribution trailers.** `scripts/check-ai-attribution.mjs`
   runs as the **first step** of `.github/workflows/pr-checks.yml` and fails the
   build on `Co-authored-by: …claude`, `Claude-Session:` or
   `Generated with Claude`.
7. **Render to verify.** For any token, chart, diagram or PDF: generate the real
   artifact and look at it. Reading the code is not verification — all four
   existing dark-mode defects in the development components looked obviously
   fine on inspection.
8. **Do not reopen the visual redesign.** `BACKLOG.md` 3.4 records three
   directions proposed and declined. Work inside the existing Matchday tokens
   and `web/src/components/ui/` primitives.
9. **Gemini only.** No second AI provider.
10. **Ask before widening scope.** If a step turns out to need a schema change
    or a product decision not written here, stop and raise it.

### Shared plumbing you must reuse, never re-copy

| Need | Use | Where |
|---|---|---|
| Model IDs | `AI_MODEL`, `AI_MODEL_DOC`, `AI_MODEL_LITE` | `web/src/lib/ai-models.ts` |
| Rate limit + error mapping | `checkAiBudget(userId)`, `aiError(err, fallback?)` | `web/src/lib/ai-guard.ts` |
| Lenient JSON parse | `parseJsonObject()` | `web/src/lib/ai-json.ts` |
| Team-scoped AI brief | `buildSquadContext()` | `web/src/app/actions/squad-context.ts` |
| Output validation discipline | `validateCounter()` | `web/src/lib/opponent-counter.ts` |
| Graceful column fallback | `isMissingAttributeColumn()` | `web/src/lib/attributes.ts:351` |
| Attendance + 75% threshold | `summariseAttendance`, `attendanceWindowStart` | `web/src/lib/attendance.ts` |
| Board geometry | `assignToSlots`, `mapNamedPositionsToSlots`, `compress` | `web/src/lib/board-model.ts` |
| Structured-output pattern | `suggestLineup`, `generateMatchPlan` | `web/src/app/actions/coach-assistant.ts:198-320` |
| App-level per-team guard | `requireCoachTeam` | `web/src/app/actions/match-plans.ts:18-28` |

Set `thinkingConfig: { thinkingBudget: 0 }` on every direct-answer Gemini call.
Thinking tokens are deducted from `maxOutputTokens`, and on a tight budget they
consume the whole request before a word of the answer is written — truncating
it with no error anywhere.

---

## Part 1 — Why

Growfit's AI works but has hit a structural ceiling. Fourteen Gemini call sites
across nine Server Actions each build a text brief, ask for prose, render it
into `useState`, and throw it away. There is **no tool use, no streaming, no
response caching and no AI table in the database**. Nothing is remembered,
nothing can answer a question no panel anticipated, and every click re-bills.
That is the previous generation of this product category: the 2026
differentiator is an assistant with persistent memory that knows the squad by
name.

The sections identified as the commercial winners — **tactics board, video
analysis, match, performance, training** — are where Growfit is closest to the
leaders and furthest from finished. The board is already the most developed
surface in the app (1,684 lines, five Zustand stores, animation playback, voice
notes, speech synthesis, a validated opponent-counter overlay). It is one layer
short of being the reason a club pays.

One thing genuinely changed since `AI_FEATURES_AND_IA.md` was written:
**Gemini video understanding went agentic** — up to 3 hours of video,
timestamp-addressable, with the model navigating the timeline and choosing
frames, audio or transcript rather than sampling up front. A U13 match is ~70
minutes. **It fits.** The video features that document parked as "later, needs
custom ML" are now a prompt and a consent gate.

### Decisions already taken

| | |
|---|---|
| Target | `web/` only. The Expo prototype at the repo root stays dormant. |
| UI/UX | Targeted fixes inside the existing Matchday token system. `BACKLOG.md` 3.4's declined redesign is not reopened. |
| AI stack | Gemini only. Add function calling, streaming, context caching, video. `@anthropic-ai/sdk` is an unused dependency and gets removed. |

---

## Part 2 — Industry benchmark

`AI_FEATURES_AND_IA.md` Part 1 already scanned StepOut, Veo, Trace, CoachFrank,
Coach OS, aiScout, Upstar, DribbleUp and the fair-playing-time apps. Those
verdicts stand. This covers what moved since, and the leaders that scan missed.

| Leader | What it does that Growfit doesn't | Verdict |
|---|---|---|
| **[TacticalPad](https://docrack.me/en/tacticalpad-2026-coaching-app-guide/)** (1M+ downloads) | 3D pitch, animated player movement, playbooks, animated **session** plans | Growfit's board already animates. **Adopt** the missing half: board → session, playbooks as a term plan |
| **[Hudl](https://www.vantasports.ai/blog/football-apps-for-coaches) / Hudl Assist** | Film Saturday, get a tagged statistical breakdown and clip playlist by Sunday — done by **human analysts** | **Adopt**, with the model doing what Hudl pays people for. Biggest feature in this plan |
| **[Sportscode](https://english-programs.sportsdatacampus.com/football-video-analysis-software/)** | Event logging tied to a tactical pitch view, reusable templates | **Adapt** — Growfit has the pitch view and the result form; wire them to video timestamps |
| **[Metrica Sports](https://english-programs.sportsdatacampus.com/football-video-analysis-software/)** | AI automatic player and pitch tracking for telestration | **Partly skip** — see the honesty note |
| **SICS Atlas** (launched Aug 2026) | **Agentic** AI across video + event + tracking data; automated scouting | **Adopt the shape** — Phase 2's agent is this at grassroots scale |
| **[FM26's AI coach](https://www.footballmanagerblog.org/2026/01/fm26-new-ai-coach-algorithm-forces.html)** | Opponent AI that learns and adjusts **mid-flow** | **Adapt** — reactive opponent shape on the board |
| **[SkillCorner](https://youthsportsbusinessreport.com/skillcorner-secures-60-million-to-expand-ai-powered-sports-tracking-across-north-america/)** ($60M raised, 180+ comps) | Single-camera automated player/ball tracking from broadcast video | **Skip building it** — a funded research company's core IP |
| **[Playermaker](https://www.playermaker.com/)** | Boot sensors measuring technique from foot motion, from age 8 | **Skip** — hardware, per-child cost an NPC can't carry |
| **[CoachAI](https://www.coachai.uk/blog/best-ai-football-coaching-tools-uk-2026) / [Hobbit](https://hobbit.football/tools/best-soccer-coaching-apps) / [FootballGPT](https://footballgpt.co/football-ai)** | Assistant that knows your squad by name; **per-team persistent memory** | **Adopt** — Phases 1–2. Growfit's thirteen one-shot panels are the previous generation |
| **[PlayerUp](https://www.playerup.co/solutions/individual-development-plans) / [FlickTec](https://flicktec.io/blog/what-is-individual-development-plan-idp-youth-soccer)** | IDPs: 3–5 goals, ongoing feedback, visible progress, **player self-evaluation** | **Adopt** — Growfit has a boolean checklist where the market has a living plan |
| **[Speakwise](https://speakwiseapp.com/blog/how-sports-coaches-record-practice-sessions)** | Coach voice capture for "outdoor fields and unreliable WiFi" | **Adopt** — the argument for voice-first on a Durban touchline |

### What phone footage cannot support

Overclaiming here is how a product loses a coach in week two.

- **No heatmaps, passing networks, distance-covered or sprint counts.** These
  need continuous multi-player tracking from a fixed wide-angle camera. The
  [open-source YOLO+ByteTrack pipelines](https://github.com/Smithaker10/football_analytics_cv)
  that look like they solve it are built for broadcast feeds with a stable
  frame. `AI_FEATURES_AND_IA.md` Part 1 reached this already and it stands.
- **No automated attribute scoring, no face recognition** — standing non-goals.
  Players are tagged by a coach or by shirt number.
- **No xG.** Shot quality needs shot location; estimating it from a phone pan
  is a guess dressed as a number.

What phone footage *does* support — and what Hudl charges analysts to do — is
**events with timestamps**. That is the whole proposition and it is enough.

---

## Part 3 — Feature catalogue (for agreement)

**BUILD** = scheduled in Part 5 · **DECIDE** = wants a call before scheduling ·
**NO** = with the reason.

### 3.1 Tactics board

Reuse, don't rebuild: `lib/board-model.ts`, `lib/board-render.ts`,
`lib/play-motion.ts` (`framesFromShapes`), the five Zustand stores,
`components/tactics/{animation-panel,voice-note-recorder,speak-button,exploit-layer}.tsx`,
and `lib/opponent-counter.ts`'s `validateCounter()` — the one real output
validator in the app. **Every new board AI feature validates through that same
discipline: unknown IDs dropped, array lengths capped, squad size checked.**

| # | Feature | Verdict |
|---|---|---|
| a | **Board → session.** Draw a play, get a 3-drill progression that teaches it (unopposed → opposed → small-sided), applied via the existing `addDrills()` | **BUILD** P3 — nothing in grassroots connects board to session plan, and both halves exist |
| b | **Reactive opponent shape.** Press play and the opposition moves *in response*, showing where the play breaks | **BUILD** P4 — FM26's learning opponent at academy scale |
| c | **Board from a sentence.** "1-4-3-3, press high, left back overlapping" → real tokens and shapes | **BUILD** P3 — structured output into `board-model.ts` types |
| d | **Narrated walkthrough.** Voice-over timed to the animation frames, so a coach can play a play *to* U11s | **BUILD** P4 — `describePlay` + `speak-button` exist; this times them |
| e | **Set-piece routines** against the opponent's observed weakness. Set pieces decide grassroots matches | **BUILD** P4 |
| f | **"My job in this play."** Plays already share to players by token; add a per-player role explanation at their reading age | **BUILD** P3 |
| g | 3D pitch view | **NO** — a rendering project, not an AI one; the 2D board isn't what holds coaches back |

### 3.2 Video analysis

Hard rules, all from `AI_FEATURES_AND_IA.md` Part 3: consent on file for every
player shown (`player_consents`); the clip goes to Gemini's Files API and is
**deleted in a `finally`**, never written to Supabase Storage, so Growfit stays
a conduit and never becomes a video host; no biometric identification; a coach
approves before a player or parent sees anything.

| # | Feature | Verdict |
|---|---|---|
| a | **Match auto-tag.** Phone on a tripod → timestamped events (goals, shots, turnovers, set pieces, cards) that **prefill the Log Result form** and create clip bookmarks | **BUILD** P5, first. Highest commercial value here |
| b | **Queryable match.** "Show me every time we lost the ball in midfield" → timestamps that deep-link into the player | **BUILD** P5 |
| c | **Clip Coach.** Short clip → timestamped moments + three coaching points | **BUILD** P5 — scoped in Part 2 #9 already |
| d | **My Moments.** Coach-approved individual moments on the passport | **BUILD** P5 |
| e | **Video → board.** A tagged moment becomes a board position the coach can animate | **DECIDE** — most novel item here, but needs (a) proven first |
| f | Tracking, heatmaps, passing networks, distance covered | **NO** — see the honesty note |
| g | Livestreaming, video hosting | **NO** — standing non-goals |

**Phase 5 is blocked on the consent gate**, which is compliance
infrastructure, not a feature session — `BACKLOG.md` says so. It starts with a
person reading the current consent form to confirm what it permits. **That is
the one item in this document that needs a human rather than a session.**

### 3.3 Match and performance

| # | Feature | Verdict |
|---|---|---|
| a | **Opponent scouting from your own history.** Past results, ratings and saved plays vs the same opponent → a pre-match brief | **BUILD** P2 — `BACKLOG.md` 5.5 approves the cheap third; this is the rest |
| b | **Match story.** The match as a timeline with a narrative, shared to players and parents | **BUILD** P4 |
| c | **Performance curves + narrative** over ratings/attendance/milestones | **BUILD** P4 — `rating-chart.tsx` covers most of the chart half |
| d | **Readiness score.** sRPE (RPE × minutes, Borg CR-10) → 7-day:28-day ACWR flag, plus attendance and rating trend, as one figure on the squad screen. [ACWR-guided load management is under cluster-randomised trial in elite youth football](https://clinicaltrials.gov/study/NCT07727382); physeal injuries peak ~U14, inside U13/U15 | **BUILD** P4, extending approved 5.4. **The AI only explains the threshold; it never decides a number** |
| e | Best-suited position | **NO** — already declined; narrowing a 12-year-old's position works against long-term development |
| f | xG / shot quality | **NO** — see the honesty note |

### 3.4 Training

| # | Feature | Verdict |
|---|---|---|
| a | **Constraint-aware sessions with diagrams.** "14 kids, 8 cones, half a pitch, 60 min, pressing" → a session with a diagram per drill on `board-render.ts` | **BUILD** P3 — approved as 5.6; diagrams stay an explicit go/no-go after rendering ~20 and looking |
| b | **Term periodisation.** Wed/Fri/Sun is a fixed microcycle — plan the **term** across it (load, five corners, fixture list), not one session at a time. [Serie A youth microcycle research](https://www.researchgate.net/publication/383304430_Training_loads_and_microcycle_periodisation_in_Italian_Serie_A_youth_soccer_players) is the model | **BUILD** P4 — what TacticalPad's playbooks gesture at, done properly |
| c | **Session → next session loop.** Register, RPE and what was coached feed the next generation | **BUILD** P3 |
| d | **Drill semantic search** over `drill_library` | **BUILD** P2, as an agent tool |
| e | **Coach CPD log.** 30-second reflection after a session → AI feedback against the 4-corner model, accumulating into a coaching development record. The academy has three volunteers, two unfilled seats, and CPR Part B and SAFA badges to maintain | **DECIDE** — most undervalued idea here. No competitor does it; one cheap call per session; serves the actual humans running the academy |

### 3.5 Player

| # | Feature | Verdict |
|---|---|---|
| a | **Self-assessment against the five corners**, shown as a gap to the coach's rating — a conversation starter, never a score. The IDP literature is unanimous that the player must self-evaluate | **BUILD** P4 — no AI call; schema plus UI, and it improves every plan |
| b | **Home challenge** from their own approved plan, text-only — no video, no consent gate, ships immediately | **BUILD** P3 |
| c | **Age-appropriate rewrite** — coach language rendered for an 11-year-old | **BUILD** P3, lite tier |
| d | Skills Challenge with camera scoring ([Worldkick](https://play.google.com/store/apps/details?id=app.foxyfitness.android.worldkick), [AthletixAI](https://github.com/manthandhanraj/AthletixAI) use on-device BlazePose/MoveNet) | **NO for now** — same consent gate as video, and a child's own skill video is the most sensitive upload in the product |
| e | Leaderboards, ranking children | **NO** — standing non-goal |

### 3.6 Coaching layer, everywhere

| # | Feature | Verdict |
|---|---|---|
| a | **The Growfit Agent** — read-only tools over real academy data, answering what no panel anticipated: *"who in U13 is missing POPIA consent and hasn't trained in two weeks?"* | **BUILD** P2 |
| b | **Talk to Growfit** — hold to talk; dictate the register, a result or a player note; everything lands as a draft | **BUILD** P3 |
| c | **Compliance chase** — documents, eligibility, duplicate IDs and consent checked weekly into a prioritised list with a pre-written WhatsApp message per parent | **BUILD** P4 |
| d | **Parent Q&A** — the agent with a hard-allowlisted tool set scoped to their own child only | **BUILD** P4 |
| e | **Weekly family digest** — one batch generation per team per week, warm, first names only | **BUILD** P4 |

---

## Part 4 — Phase 0: fix the authorization hole

**Ship this alone, before anything else, whether or not Part 3 is agreed.**

### The defect

`generateDevelopmentPlan` (`web/src/app/actions/development-plan.ts:18`),
`getPlayerInsights` (`web/src/app/actions/ai-insights.ts:20`) and
`generateAcademyHealthReport` (`web/src/app/actions/academy-health.ts:10`) each
call only `requireUser()`, which does exactly one thing
(`web/src/lib/auth.ts:19-24`): confirm somebody is signed in. No role check. No
"is this your player" check.

`players` is readable academy-wide with no role restriction:

```sql
-- supabase/migrations/001_schema.sql:240
CREATE POLICY "player_academy_read" ON players
  FOR SELECT USING (academy_id = auth_academy_id());
```

and a parent's `profiles.academy_id` **is** populated, by
`supabase/migrations/032_parent_link_verification.sql:367`
(`UPDATE profiles SET academy_id = v_p_academy WHERE id = auth.uid()`).

So any signed-in player or parent can pass **any other child's** `playerId` and
receive a coach-grade LTPD critique of that child — ratings, attributes,
attendance, weaknesses. `DevelopmentPlanPanel` is already mounted on
`web/src/app/(protected)/dashboard/player/development/page.tsx:97`, so the
action is wired into a player's browser today. This is a POPIA and
safeguarding exposure.

### Step 0.1 — Gate the three actions

**Files**

| File | Change |
|---|---|
| `web/src/lib/auth.ts` | add `requireStaff()`, `getRole()` |
| `web/src/lib/coached-teams.ts` | add `coachesPlayer()` |
| `web/src/app/actions/development-plan.ts` | gate on staff + `coachesPlayer` |
| `web/src/app/actions/ai-insights.ts` | same gate |
| `web/src/app/actions/academy-health.ts` | staff-only gate |
| `web/src/app/(protected)/dashboard/player/development/page.tsx` | remove `DevelopmentPlanPanel`; `EmptyState` saying the coach shares the plan |
| `web/src/lib/__tests__/auth-guards.test.ts` | new — pure role-predicate tests |

**Signatures**

```ts
// web/src/lib/auth.ts
export interface StaffContext {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>;
  user: User;
  /** Null when the caller is not coach/admin. The caller returns
   *  { error: "..." } — a Server Action must not redirect() mid-action. */
  profile: { id: string; role: UserRole; academy_id: string | null } | null;
}
export async function requireStaff(): Promise<StaffContext>;

// web/src/lib/coached-teams.ts
/** True when this user may act on this player: an admin in the same academy,
 *  or a coach of a team the player is an active member of. This is the
 *  boundary RLS does NOT draw — player_academy_read is academy-wide. */
export async function coachesPlayer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { userId: string; role: UserRole; playerId: string }
): Promise<boolean>;
```

Mirror `requireCoachTeam`'s app-level-guard pattern
(`web/src/app/actions/match-plans.ts:18-28`), which exists for the same reason:
RLS on these tables is academy-wide, not per-team.

**Acceptance**

- A player or parent calling any of the three actions with another child's
  `playerId` gets `{ error: ... }` and no model call is made (gate before
  `checkAiBudget`, so a probe doesn't burn budget either).
- A coach of the player's team succeeds. An admin in the same academy succeeds.
- A coach of a different team in the same academy is refused for
  `development-plan` and `ai-insights`.
- The player development page renders an `EmptyState`, not a generate button.
- `npx tsc --noEmit` passes after `rm -f web/tsconfig.tsbuildinfo` (this step
  changes inferred return types).

### Related, and a separate decision

`academy_members_read_completions`
(`supabase/migrations/012_development_features.sql:47`) keys on the *reader's*
`profiles.academy_id`, so a parent can already read every child's milestone
completions in the academy. Tightening it to `parent_player_links` is a
one-policy migration, but it changes an existing policy and wants confirming
separately rather than being slipped into this work. **Raise it; don't do it
here.**

---

## Part 5 — Build order

| Phase | What | Why here |
|---|---|---|
| **0** | The authorization fix | Live safeguarding defect. Ships alone, first |
| **1** | Development Engine: `ai_artefacts`, the Develop rebuild, persistent plans with memory, parents included | Everything later needs persistence, provenance and a coach-approval gate. Build it once |
| **2** | The Growfit Agent: tools, streaming, context caching, opponent scouting, drill search | Replaces scattered panels rather than adding to them; the tool registry is what P3–P5 call |
| **3** | Board → session, board from a sentence, my job in this play, constraint-aware sessions with diagrams, session loop, voice capture, home challenge, age-appropriate rewrite | The training/tactics loop closes. All reuse P2's tools |
| **4** | Reactive opponent, set pieces, narrated walkthrough, term periodisation, readiness, match story, performance curves, family layer, compliance chase, self-assessment, coach CPD | The depth that makes the winning sections win |
| **5** | **Consent gate first**, then match auto-tag, queryable match, Clip Coach, My Moments | Highest commercial value, hardest prerequisite |
| Ongoing | Quality bar (Part 7) + UX workstream (Part 8) | Lands with whichever phase touches the surface |

Already approved and separately scheduled, **not re-planned here**: fair
game-time planner, voice match log, post-match parent recap (`BACKLOG.md`
5.1–5.3). Phase 1's artefact store, approval gate and cache give each of them a
home for free.

---

## Part 6 — Phase 1 implementation spec

### Step 1.1 — Migration 045 and the artefact store

**Migration numbering.** `044_fixture_delete.sql` is the current highest, so the
new file is `045_ai_artefacts.sql`. Note `BACKLOG.md` 5.0 and 5.4 still reserve
"043" and "044" — **both numbers are already taken** (043 is
`private_player_photos`, 044 is `fixture_delete`). Renumber those backlog
references to 046+ in this step's documentation commit.
`MIGRATION_RUNBOOK.md` documents 035–041 only; backfill 042–044 while you are
there.

**Files**

| File | Change |
|---|---|
| `supabase/migrations/045_ai_artefacts.sql` | new |
| `web/src/lib/ai-artefacts.ts` | new — read/write/cache/feedback helper |
| `web/src/lib/friendly-error.ts` | add `42P01` / `PGRST205` to `CODE_MESSAGES` |
| `web/src/app/actions/player-erasure.ts` | delete artefacts before the `players` delete |
| `web/src/lib/__tests__/ai-artefacts.test.ts` | new — pure parts only |
| `docs/MIGRATION_RUNBOOK.md` | 045 section + backfill 042–044 |

**Two design points that are easy to get wrong.**

*The kind split is the safeguarding mechanism.* `development_plan` holds the
coach's full plan including the private concern note and the verdict on the
previous plan. `development_plan_shared` holds **only** the player-safe subset,
written as a **second row** at approval time. RLS is row-level, not
column-level — letting a player `SELECT` the coach's row hands them
`data.coachNote` no matter what the UI hides. Two rows is the enforcement.

*`approved_by_name` is denormalised on purpose.* `profiles` RLS
(`001_schema.sql:225-228`) lets a player or parent read only their own row, so a
nested join to resolve the approving coach's name returns `null` on exactly the
surfaces that need it — and returns it **silently**, reading as "nobody approved
this". The same trap applies to `completed_by` on the timeline in step 1.5.

```sql
-- 045_ai_artefacts.sql
--
-- Every AI output in this app currently lives in a useState and is thrown away
-- (BACKLOG.md 3.2 / IP-16). A coach who generated a development plan on Tuesday
-- cannot see it on Wednesday, and regenerating bills the academy's Gemini key
-- again for an answer nobody disagreed with.
--
-- Staff RLS follows 041_fixture_match_plans exactly
-- (is_admin_or_coach() AND academy_id = auth_academy_id(), per 038/040).
-- Two extra SELECT-only policies let a player see their own and a parent their
-- linked child's, but ONLY kind='development_plan_shared' and ONLY once a coach
-- approved it. See the kind-split note in docs/AI_AND_UX_PLAN_2026.md.
--
-- subject_id is deliberately polymorphic with NO foreign key, which means
-- deleting a player does NOT cascade here. player-erasure.ts deletes these rows
-- explicitly — POPIA erasure is not optional and a cascade that doesn't exist
-- cannot be relied on.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_artefacts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id         UUID        NOT NULL REFERENCES academies(id) ON DELETE CASCADE,

  kind               TEXT        NOT NULL CHECK (kind IN (
                                   'development_plan',
                                   'development_plan_shared',
                                   'player_insights',
                                   'academy_health',
                                   'match_plan',
                                   'session_plan',
                                   'parent_report',
                                   'match_report')),
  subject_type       TEXT        NOT NULL CHECK (subject_type IN ('player','fixture','team','academy')),
  subject_id         UUID        NOT NULL,

  data               JSONB       NOT NULL,
  prose              TEXT,

  model_id           TEXT        NOT NULL,
  -- sha256 of the exact brief text sent to the model. The cache-hit rule is one
  -- equality check against this, instead of re-querying four input tables to
  -- ask "has anything changed since".
  inputs_fingerprint TEXT        NOT NULL,

  prompt_tokens      INTEGER,
  output_tokens      INTEGER,
  thinking_tokens    INTEGER,
  total_tokens       INTEGER,

  status             TEXT        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','approved')),
  approved_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  -- Denormalised: profiles RLS (001_schema.sql:225-228) lets a player or parent
  -- read only their OWN profile row, so a join to resolve this name returns
  -- null on exactly the surfaces that need it — and silently.
  approved_by_name   TEXT,
  approved_at        TIMESTAMPTZ,

  feedback           TEXT        CHECK (feedback IN ('helpful','not_helpful')),
  feedback_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  feedback_at        TIMESTAMPTZ,

  -- Set when a newer artefact replaces this one. History is kept rather than
  -- upserted away (unlike fixture_match_plans' one-row-per-fixture), because
  -- "did the last plan work" is exactly what gets fed back to the model.
  superseded_at      TIMESTAMPTZ,

  created_by         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_artefacts_subject_idx
  ON ai_artefacts (subject_type, subject_id, kind, created_at DESC);

-- The cache-hit lookup and the "current plan" lookup are both this shape.
CREATE INDEX IF NOT EXISTS ai_artefacts_live_idx
  ON ai_artefacts (kind, subject_id, inputs_fingerprint)
  WHERE superseded_at IS NULL;

-- The admin usage card: tokens and feedback per academy per month.
CREATE INDEX IF NOT EXISTS ai_artefacts_academy_idx
  ON ai_artefacts (academy_id, created_at DESC);

ALTER TABLE ai_artefacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_artefacts_staff_all" ON ai_artefacts;
CREATE POLICY "ai_artefacts_staff_all" ON ai_artefacts
  FOR ALL TO authenticated
  USING      (is_admin_or_coach() AND academy_id = auth_academy_id())
  WITH CHECK (is_admin_or_coach() AND academy_id = auth_academy_id());

DROP POLICY IF EXISTS "ai_artefacts_player_read" ON ai_artefacts;
CREATE POLICY "ai_artefacts_player_read" ON ai_artefacts
  FOR SELECT TO authenticated
  USING (
    kind = 'development_plan_shared'
    AND subject_type = 'player'
    AND status = 'approved'
    AND superseded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM players p
       WHERE p.id = ai_artefacts.subject_id AND p.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_artefacts_parent_read" ON ai_artefacts;
CREATE POLICY "ai_artefacts_parent_read" ON ai_artefacts
  FOR SELECT TO authenticated
  USING (
    kind = 'development_plan_shared'
    AND subject_type = 'player'
    AND status = 'approved'
    AND superseded_at IS NULL
    AND EXISTS (
      SELECT 1 FROM parent_player_links ppl
       WHERE ppl.player_id = ai_artefacts.subject_id AND ppl.parent_id = auth.uid()
    )
  );

COMMENT ON COLUMN ai_artefacts.inputs_fingerprint IS
  'sha256 of the brief sent to the model. Cache hit requires this plus '
  'model_id to match and superseded_at IS NULL -- see lib/ai-artefacts.ts.';

COMMIT;

-- Safe to re-run: CREATE ... IF NOT EXISTS, every policy dropped by name first.
-- Verify with:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'ai_artefacts';
--   -- expect 3: staff_all (ALL), player_read (SELECT), parent_read (SELECT)
-- Then as a player (SET LOCAL ROLE authenticated, request.jwt.claim.sub = that
-- player's profile id): SELECT kind, data FROM ai_artefacts;
--   -- expect ONLY their own development_plan_shared rows, never a
--   -- 'development_plan' row, and never another child's.
```

**The cache-hit rule**, to be documented in `ai-artefacts.ts`'s header. A
stored artefact is served instead of a Gemini call only when **all** hold:

1. `kind`, `subject_type`, `subject_id` match;
2. `superseded_at IS NULL`;
3. `inputs_fingerprint` equals the fingerprint of the brief just built — i.e.
   nothing the model saw has changed;
4. `model_id` equals the currently configured model for that kind, so a
   `GEMINI_MODEL` change forces a regenerate (exactly the failure
   `ai-models.ts`'s own header describes);
5. `created_at` is inside the kind's window — `development_plan` 28 days
   (its own 4-week horizon), `player_insights` 7 days, `academy_health` 24h;
6. the caller didn't pass `force: true`.

Invalidation then needs **no cache-busting calls anywhere**: a new completion,
rating or register mark changes the brief, so the fingerprint changes and
condition 3 fails. A model change fails 4. Time fails 5. An explicit Regenerate
fails 6 and additionally stamps `superseded_at = now()` on the previous live
row so history stays linear.

> **The load-bearing consequence: `buildDevelopmentBrief` must be
> deterministic.** Any unstable ordering — an unsorted `.select()` result, a
> `Map` iteration, a timestamp in the text — makes the fingerprint thrash, the
> cache never hit, and the only symptom is a bill nobody traces. Sort every
> collection inside the builder.
>
> **The opposite error is just as real.** The brief includes attendance over a
> rolling window (`attendanceWindowStart()`), which moves daily — so the
> fingerprint would change every day with no new data and the 28-day TTL would
> never be used. Bucket the window start to a fixed boundary inside the builder
> and comment why.

```ts
// web/src/lib/ai-artefacts.ts
// NOT "use server" — plain helpers taking the client, matching lib/features.ts
// and lib/coached-teams.ts.
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiArtefactKind =
  | "development_plan" | "development_plan_shared" | "player_insights"
  | "academy_health"   | "match_plan"             | "session_plan"
  | "parent_report"    | "match_report";

export type AiSubjectType = "player" | "fixture" | "team" | "academy";
export type AiArtefactStatus = "draft" | "approved";
export type AiFeedback = "helpful" | "not_helpful";

export interface AiArtefactTokens {
  prompt: number | null; output: number | null;
  thinking: number | null; total: number | null;
}

export interface AiArtefact<T = unknown> {
  id: string;
  kind: AiArtefactKind;
  subjectType: AiSubjectType;
  subjectId: string;
  data: T;
  prose: string | null;
  modelId: string;
  inputsFingerprint: string;
  tokens: AiArtefactTokens;
  status: AiArtefactStatus;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  feedback: AiFeedback | null;
  supersededAt: string | null;
  createdBy: string;
  createdAt: string;
}

/** True when migration 045 hasn't been applied: PostgREST PGRST205,
 *  Postgres 42P01. DISTINCT from isMissingAttributeColumn (PGRST204 / 42703),
 *  which are the *column* codes and do NOT fire for a missing table. Reusing
 *  the column helper here would surface a hard failure on a coach's screen. */
export function isMissingAiArtefactsTable(
  error: { code?: string } | null | undefined
): boolean;

/** sha256 hex of the brief. node:crypto; server-only. */
export function fingerprintBrief(brief: string): string;

/** Narrow, defensive read of @google/genai's usageMetadata. Returns all-null
 *  rather than throwing when the shape differs — token counts are telemetry,
 *  never worth failing a coach's request over. node_modules is not installed
 *  in the planning checkout, so the field names are UNVERIFIED: write this
 *  defensively and confirm against a real response. */
export function readUsage(response: unknown): AiArtefactTokens;

/** Per-kind freshness window in ms. */
export const AI_ARTEFACT_TTL: Record<AiArtefactKind, number>;

/** Pure: the documented cache rule. Unit-testable with no network. */
export function isCacheHit(
  artefact: Pick<AiArtefact, "modelId" | "inputsFingerprint" | "supersededAt" | "createdAt" | "kind">,
  want: { modelId: string; inputsFingerprint: string },
  now?: Date
): boolean;

export async function getLatestAiArtefact<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    kind: AiArtefactKind; subjectType: AiSubjectType; subjectId: string;
    status?: AiArtefactStatus; includeSuperseded?: boolean;
  }
): Promise<{ artefact: AiArtefact<T> | null; available: boolean; error?: string }>;

export async function saveAiArtefact<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    kind: AiArtefactKind; subjectType: AiSubjectType; subjectId: string;
    academyId: string; createdBy: string;
    data: T; prose?: string | null;
    modelId: string; inputsFingerprint: string;
    tokens?: AiArtefactTokens; status?: AiArtefactStatus;
    /** Stamp superseded_at on the previous live artefact of the same
     *  kind+subject. Default true. */
    supersedePrevious?: boolean;
  }
): Promise<{ artefact: AiArtefact<T> | null; persisted: boolean; error?: string }>;

export async function listAiArtefacts<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    subjectType: AiSubjectType; subjectId: string;
    kind?: AiArtefactKind; limit?: number;
  }
): Promise<{ artefacts: AiArtefact<T>[]; available: boolean; error?: string }>;

export interface AiUsageSummary {
  calls: number;
  totalTokens: number | null;
  helpful: number;
  notHelpful: number;
  byKind: { kind: AiArtefactKind; calls: number; totalTokens: number | null }[];
}
export async function summariseAiUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { academyId: string; since: string }
): Promise<{ summary: AiUsageSummary | null; available: boolean }>;

export async function deleteAiArtefactsForSubject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: { subjectType: AiSubjectType; subjectId: string }
): Promise<{ deleted: boolean; error?: string }>;
```

`available: false` is the lagging-migration signal, mirroring
`getAcademyFeatures`' "every feature reads as on": the caller falls through to a
live Gemini call, so the UI loses persistence, not function.

**Acceptance**

- No call site adopts the store in this step — it is additive and provable
  alone.
- With the table absent, `getLatestAiArtefact` returns
  `{ artefact: null, available: false }` and never throws.
- `isCacheHit` unit tests cover each of the six conditions failing
  independently.
- Erasing a player removes their artefacts (code path reviewed; the live check
  is in Part 9).

### Step 1.2 — One category module and five tokens

The five category maps are duplicated in **four** places, and they disagree:

| File | Value |
|---|---|
| `web/src/components/development/milestone-progress.tsx:30-48` | `text-blue-700` + `bg-blue-500` bars |
| `web/src/components/development/milestone-card.tsx:8-14` | `text-blue-600` |
| `web/src/app/(protected)/dashboard/coach/squad/[playerId]/page.tsx:515-525` | `text-blue-700` |
| `web/src/app/(protected)/dashboard/admin/development/milestone-form.tsx:12-27` | `text-blue-700` |

All four use raw Tailwind palette colours instead of tokens, so this is the one
part of the app that won't re-theme, and `text-blue-700` on `bg-blue-500/15` is
tuned for a light page only — it is a dark-mode defect in all four.

**Files**: `web/src/lib/development-categories.ts` (new),
`web/src/app/globals.css`, `web/src/app/actions/development.ts` (re-export
`MilestoneCategory` from the lib module, the `board-model.ts` precedent, so
existing imports keep working), `web/src/lib/__tests__/development-categories.test.ts`
(new), `web/src/app/(protected)/dashboard/admin/ui/page.tsx` (add a category
chip row so both themes are inspectable).

```ts
// web/src/lib/development-categories.ts
import type { LucideIcon } from "lucide-react";

export type MilestoneCategory =
  | "technical" | "tactical" | "physical" | "mental" | "leadership";

/** Display order. Matches 012_development_features.sql's CHECK order. */
export const MILESTONE_CATEGORIES: readonly MilestoneCategory[];

export interface MilestoneCategoryMeta {
  key: MilestoneCategory;
  label: string;   // "Technical"
  short: string;   // "Tech" — the five-up bar strip on a phone
  Icon: LucideIcon;
  /** Tinted chip: "bg-dev-technical/15 text-dev-technical" */
  chip: string;
  /** Solid fill for a bar or a completed check: "bg-dev-technical" */
  fill: string;
  /** For an inline style() where a class won't do */
  cssVar: string;  // "var(--color-dev-technical)"
}
export const MILESTONE_CATEGORY_META: Record<MilestoneCategory, MilestoneCategoryMeta>;

/** Null (not a throw, not a silent default) for an unrecognised DB value. */
export function categoryMeta(key: string | null | undefined): MilestoneCategoryMeta | null;

export interface CategoryProgress {
  key: MilestoneCategory;
  meta: MilestoneCategoryMeta;
  total: number;
  done: number;
  /** Null when total is 0 — never a misleading 0%. StatTile's convention. */
  pct: number | null;
}
export function summariseByCategory(
  templates: readonly { id: string; category: MilestoneCategory }[],
  completedTemplateIds: ReadonlySet<string>
): {
  overall: { total: number; done: number; pct: number | null };
  byCategory: CategoryProgress[];   // only categories with total > 0
};

/** Season key. One place, replacing the scattered new Date().getFullYear(). */
export function currentSeason(now?: Date): string;
```

Add five `--color-dev-*` tokens to `globals.css` in `@theme` **and** in the
`.dark` block, following the existing `--color-rating-{high,mid,low}`
convention. **Read the `dataviz` skill and run its contrast validator before
committing the values** — these are the app's first categorical palette, they
must clear 4.5:1 on both `#faf7f2` and `#14110e`, and reading hex and judging it
fine is exactly how the four existing defects got in.

Also in this step: replace both
`style={{ backgroundColor: "currentColor", borderColor: "currentColor" }}` tick
marks (`milestone-card.tsx:83`, `milestone-progress.tsx:114`) with the
category's `fill` class and a `text-background` tick. The current code sets
background *and* border to `currentColor` while the tick is also
`currentColor`-derived, which is why the tick in `milestone-progress.tsx`
(`text-white` on an inherited fill) is effectively invisible.

> **Two gotchas.** Never `cn()` a solid `bg-dev-*` next to another `bg-*` — one
> gets silently dropped; that is the documented `pitch-lines`/`bg-ink` bug in
> `globals.css`. And these class strings exist only as literals inside a `.ts`
> file; Tailwind v4 scans source so it should work (the existing
> `CATEGORY_STYLES` objects prove the pattern), but **there is no
> `tailwind.config` in `web/`** to safelist into if it doesn't — so verify by
> rendering the `admin/ui` page in a real build, not by reading CSS.

**Acceptance**: no consumer changes yet (additive step); unit tests cover order
stability, `summariseByCategory` at zero/partial/full, and the unknown-key
fallback; both themes visually checked on `admin/ui`.

### Step 1.3 — Shared AI panel primitive

`development-plan-panel.tsx` and `ai-insights-panel.tsx` are identical apart
from the action name and the copy — confirmed by diff. Both collapse into thin
wrappers around a new primitive.

**Files**: `web/src/components/ai/ai-panel.tsx` (new),
`web/src/components/ui/spinner.tsx` (new), the two panels reduced to wrappers,
`web/src/components/ai/__tests__/ai-panel.test.tsx` (new),
`web/src/components/ui/stat-bar.tsx` (add a `color` prop),
`web/src/app/(protected)/dashboard/admin/ui/page.tsx` (gallery row).

`AiPanel` is built on `Card`/`Button`/`EmptyState`, shows provenance
("generated 3 Oct · Refresh") instead of an empty prompt, carries the 👍/👎
control, and uses the new shared `Spinner`. **Drop the phrase "AI-powered" from
the copy** — `AI_FEATURES_AND_IA.md` Part 4 rules it out.

`ui/stat-bar.tsx` currently hardcodes its fill via a private
`ratingColor(value)` mapping *percentage* to `--color-rating-*`. Colouring the
five corners by completion percentage would be meaningless — a corner needs its
own identity colour. Add an optional `color?: string` defaulting to the existing
band behaviour, so every current call site is untouched. Check
`ui/rating-ring.tsx` for the same constraint before using it in 1.4.

**Deliberately not migrated in this step**: `parent-report-panel`,
`match-report-panel`, `session-generator-panel`, `academy-health-panel`. They
have their own forms and Apply buttons; migrating them here makes the PR
unreviewable. They follow as a separate behaviour-preserving pass.

**Acceptance**: render tests for idle / pending / error / content / read-only;
every existing `StatBar` call site renders unchanged.

### Step 1.4 — Rebuild the Develop surfaces

**Files**: `web/src/lib/development-data.ts` (new),
`web/src/components/development/development-overview.tsx` (new),
`milestone-progress.tsx` (shim or delete + repoint its two callers),
`milestone-card.tsx`, `coach/squad/[playerId]/page.tsx`,
`player/development/page.tsx`, `admin/development/page.tsx`,
`admin/development/milestone-form.tsx`, plus a render test.

```ts
// web/src/lib/development-data.ts
export interface MilestoneCompletion {
  templateId: string; season: string; completedAt: string;
  note: string | null;
  /** Null on a player/parent surface — profiles RLS forbids the join there and
   *  returns null silently. Render "your coach", never an empty string. */
  completedByName: string | null;
}
export interface DevelopmentSnapshot {
  templates: MilestoneTemplate[];
  currentSeason: string;
  completedThisSeason: ReadonlySet<string>;
  seasons: SeasonProgress[];        // newest first
  /** Non-null means a query failed. Show it with RetryButton — never let a
   *  failed load render as "no milestones yet" (BACKLOG.md 4.1). */
  loadError: string | null;
}
export async function loadDevelopmentSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    playerId: string; academyId: string | null; position: string | null;
    /** Coach/admin only — resolves completed_by to a name. */
    resolveCompletedBy?: boolean;
  }
): Promise<DevelopmentSnapshot>;
```

These pages currently drop query errors, so a failed load renders as "no
milestones yet" rather than as an error — `BACKLOG.md` 4.1's lesson, in a second
place. `loadDevelopmentSnapshot` must also distinguish `academyId == null` (a
parent linked but never verified) from "query returned nothing", and set
`loadError` accordingly — otherwise that parent sees "no milestones yet" when
the truth is "we can't show this yet".

`development-overview.tsx` is one shared server component, read-only or
interactive, replacing the inline IIFE at
`coach/squad/[playerId]/page.tsx:498-585` and its local constants at 515-525.

Primitives per screen — reuse, do not invent:

| Screen | Primitives |
|---|---|
| Coach Development tab | `Card`, `Badge`, `Button`, `StatTile`, `EmptyState`, `ListRow`+`ListRowGroup`+`wrapSubtitle`, `InfoTip`, `SectionTabs` (Milestones / Plan / History) |
| Player development | `PageHeader` (replaces `<h1 className="text-2xl font-bold">`), `StatTile`, `RatingRing`, `EmptyState`, `Badge`, `ListRow`, `Skeleton` |
| Admin development | `PageHeader`, `Card`, `Button`, `Badge`, `EmptyState`, `ConfirmDialog` (template deletion is a bare button today), `Sheet` for the form |
| Parent `#development` | `Card`, `Badge`, `ListRow`+`wrapSubtitle`, `StatTile`, `EmptyState`, `InfoTip` |

**Acceptance**: zero raw Tailwind palette colours left in
`web/src/components/development/` or the four duplicate sites; a failed query
renders an error with a retry, never an empty state; both themes checked.

### Step 1.5 — Season timeline (no migration needed)

`player_milestone_completions` (migration `012`) has stored
`completed_at timestamptz DEFAULT now()`, `completed_by` and `season` since the
beginning, and **nothing has ever read them.** Drop the
`.eq("season", currentSeason)` narrowing, group by season, render
reverse-chronological `ListRow`s plus per-season per-corner progress.

**Do not use recharts in Phase 1.** Completion data is a handful of rows per
season and a line chart over it is decoration. The existing chart theming is
also broken — `rating-chart.tsx:23,26` uses `stroke="hsl(var(--border))"`
against hex tokens, invalid CSS silently falling back to recharts defaults.
Pre-existing; fix it as its own item and **don't copy the pattern**.

**Files**: `development-data.ts` (grouping + `resolveCompletedBy`),
`milestone-timeline.tsx` (new), `season-progress.tsx` (new), and a pure
grouping/sorting unit test.

### Step 1.6 — Development plans that remember

**Files**: `web/src/lib/development-brief.ts` (new, pure),
`web/src/lib/development-plan-view.ts` (new, pure),
`web/src/lib/ai-safeguards.ts` (new),
`web/src/app/actions/development-plan.ts` (rewritten),
`development-plan-panel.tsx`, `web/src/components/ai/ai-feedback.tsx` (new),
plus two unit tests.

> **`buildSquadContext()` cannot be reused here.** It is team-scoped and gated
> on `getCoachedTeamIds` (`squad-context.ts:48-54`, returns "You don't coach
> this team."). This needs a new **player-scoped** brief builder in the same
> style.

```ts
// web/src/app/actions/development-plan.ts
export interface DevelopmentFocusArea {
  category: MilestoneCategory; area: string; why: string;
}
export interface DevelopmentAction {
  what: string; how: string; timesPerWeek: number; measure: string;
  /** Links the action to a real open milestone when one matches, so the plan is
   *  actionable against the academy's own pathway, not free-floating. */
  milestoneTemplateId: string | null;
}
export interface PreviousPlanVerdict {
  verdict: "worked" | "partly" | "not_yet" | "no_previous_plan";
  evidence: string;          // coach-only: cites real completions/ratings
  carriedForward: string[];
}
export interface DevelopmentPlanStructured {
  playerSummary: string;
  focusAreas: DevelopmentFocusArea[];   // 2-3
  actions: DevelopmentAction[];         // 3-4
  reviewDate: string;                   // ISO yyyy-mm-dd
  previous: PreviousPlanVerdict;        // coach-only
  coachNote: string;                    // coach-only; may name a concern
  playerNote: string;                   // player/parent-safe; never negative
}

/** Signature changes from (playerId: string) to an object — two call sites to
 *  update. rm tsconfig.tsbuildinfo before tsc on this step. */
export async function generateDevelopmentPlan(input: {
  playerId: string; force?: boolean;
}): Promise<{
  plan?: string; structured?: DevelopmentPlanStructured;
  artefactId?: string; cached?: boolean; persisted?: boolean; error?: string;
}>;

/** Coach approval. Writes approved_by_name from the coach's own profile (the
 *  one row they can read) and inserts the 'development_plan_shared' row that
 *  the player/parent RLS policies admit. */
export async function approveDevelopmentPlan(
  artefactId: string
): Promise<{ success?: boolean; error?: string }>;

export async function setDevelopmentPlanFeedback(
  artefactId: string, feedback: "helpful" | "not_helpful" | null
): Promise<{ success?: boolean; error?: string }>;
```

```ts
// web/src/lib/development-plan-view.ts
/** The player/parent projection. Deliberately a DIFFERENT type, not a
 *  Partial<> — so the compiler, not a reviewer, catches a coach-only field
 *  reaching a player surface. */
export interface PlayerSafeDevelopmentPlan {
  focusAreas: DevelopmentFocusArea[];
  actions: DevelopmentAction[];
  reviewDate: string;
  playerNote: string;
}
/** Applied SERVER-SIDE before the data crosses to a player/parent page —
 *  filtering in a client component still ships coachNote in the RSC payload.
 *  The 'development_plan_shared' row stores exactly this. */
export function toPlayerSafePlan(s: DevelopmentPlanStructured): PlayerSafeDevelopmentPlan;
export function renderDevelopmentPlanProse(s: DevelopmentPlanStructured): string;
export function renderPlayerPlanProse(s: PlayerSafeDevelopmentPlan): string;
```

Follow the `responseSchema` pattern already proven in `suggestLineup` /
`generateMatchPlan` (`coach-assistant.ts:198-320`) and `generateSessionPlan`
(`session-generator.ts:108-140`): `Type.OBJECT`/`Type.ARRAY`,
`parseJsonObject()` with its fallback slice, then prose rendered **server-side
from the structured data by plain template** — no second model call — so every
existing `AiProse` call site keeps rendering unchanged.

**The loop that closes.** On regeneration the brief carries the previous plan
plus what actually happened since its `created_at` — new completions, new
ratings, attendance in the window — **pre-computed**, so the model is told the
facts rather than asked to diff two blobs. It fills `previous`. That is the
first thing in the app that can say whether the last plan worked.

**Safeguarding.** Extract `COACH_SYSTEM` (`coach-assistant.ts:24-31`) into
`lib/ai-safeguards.ts`, absorbing the four near-identical "UEFA Pro Licence"
strings (`tactics.ts:76,147,215,309`) and the triplicated `getLTPDPhase()`
(`tactics.ts:19`, `session-generator.ts:56`, inline in `ai-insights.ts:139`).
Add two rules: a plan is coach-approved before any player or parent sees it,
and player-facing text names no deficit.

> **Raise `maxOutputTokens` to ~1400** (in line with `generateMatchPlan`'s
> 1500). The current 600 will truncate the structured JSON mid-object, and
> `parseJsonObject` then returns null — surfacing as "Could not read the AI's
> plan" on every single attempt, with no clue why.

**Acceptance**: the regression test asserting `toPlayerSafePlan` output
contains **no** `coachNote` and **no** `previous`; determinism test building the
same brief twice from shuffled arrays and asserting one fingerprint; both
`generateDevelopmentPlan` call sites updated.

### Step 1.7 — Player and parent read-only views

**Files**: `player/development/page.tsx`,
`web/src/components/development/development-plan-readonly.tsx` (new),
`parent/[childId]/page.tsx` (new `#development` section; add "Development" to
the existing anchor chips at `211-215`), plus a render test.

No new parent nav item — the parent view is per-child and the existing
anchor-chip pattern is the right home. `AI_FEATURES_AND_IA.md` Part 4 says
don't add to the flat list.

Both views take `PlayerSafeDevelopmentPlan`, never the full structure.

> **Gate this step on a human reading real model output** for a child with
> falling ratings and 40% attendance, to confirm `playerNote` stays
> non-negative under adversarial input. Ship 1.6's coach-only approval flow
> first.

### Step 1.8 — Adopt the store at two more call sites

**Files**: `ai-insights.ts` (persist + cache as `player_insights`),
`academy-health.ts` (persist + cache as `academy_health`,
`subject_type = 'academy'`), `admin/analytics/page.tsx` (an "AI usage" card:
calls this month, tokens, helpful/not-helpful — `StatTile` ×3, `null` where a
count failed), `academy-health-panel.tsx` (provenance + feedback).

### Step 1.9 — Cleanup and docs

Remove `@anthropic-ai/sdk` from `web/package.json` (zero imports, verified) and
`@google/generative-ai` from the root `package.json` (superseded by
`@google/genai`; the Expo app has no AI code). Add
`thinkingConfig: { thinkingBudget: 0 }` to `player-import.ts:152` — the one call
site outside the convention `web/CLAUDE.md` mandates. Update `BACKLOG.md`,
`MIGRATION_RUNBOOK.md` and `web/CLAUDE.md` per Part 10.

> **One taxonomy warning.** Drill categories
> (`coach/training/[id]/page.tsx:21-23`) are `technical | tactical | fitness` —
> three values, and `fitness ≠ physical`. **Do not merge them** into the
> development module; they are unrelated enums that happen to share two words.

---

## Part 7 — The quality bar

The guard rails are good for the app's size: per-user budget, no provider-error
leakage, output validated before anything is drawn or saved, `thinkingBudget: 0`
everywhere. What separates Growfit from the leaders is the layer underneath.

1. **Tool use** (P2) — a registry in `web/src/lib/ai-tools/`, each tool a
   declaration plus a handler running the same Supabase query the UI uses,
   **under the caller's own session, so RLS does the authorisation**. Tools:
   `getSquad`, `getPlayer`, `getAttendance`, `getFixtures`, `getMilestones`,
   `getDocumentStatus`, `getWelfareAlerts`, `searchDrills`. Verify the
   `tools`/`functionDeclarations` shape against the installed `@google/genai`
   types rather than from memory, per `AGENTS.md`.
2. **Streaming** (P2) — `generateContentStream`. `BACKLOG.md` 2.5 skipped it;
   with tool calls the wait gets longer, so it stops being optional. **This is
   the one place `thinkingBudget: 0` is relaxed**, because it is the one
   genuinely multi-step task in the app — and the failure mode is a silent
   truncation that reads as the model stopping mid-sentence.
3. **Context caching** (P2) for the academy-stable part of the brief, keyed on
   `academy_id` plus a roster version.
4. **Provenance and feedback** (P1) — the app's first AI observability.
5. **A golden-set eval** — ~20 recorded real inputs per high-value kind, re-run
   after any prompt change, graded on the safeguarding rules. Cheap, and the
   only thing that makes prompt edits safe.
6. **Batch generation** overnight for anything nobody is waiting on.
7. **Prompt consolidation** — nine inline system prompts, four near-identical,
   one helper triplicated.
8. **Deep links, not just prose** — every claim about a real row returns that
   row's href. The Apply-button principle, extended to chat.

---

## Part 8 — UX workstream

Not a redesign. Each item lands with whichever phase touches that surface.

1. **Adopt `EmptyState`.** Two importers today — `player-passport-card.tsx` and
   the `admin/ui` gallery itself — so in practice every real empty state is
   hand-rolled as a `Card` with a `CardTitle`. Highest cheap win in the app.
2. **`AiPanel` + `Spinner`** rolled out to the remaining eleven AI surfaces, so
   all of them get consistent loading, error, provenance, refresh and feedback
   for free.
3. **Motion, minimally** — no library; CSS transitions and `@starting-style`
   for list entry, sheets and the development ring. `prefers-reduced-motion` is
   already honoured globally; keep it that way.
4. **Haptics** (`navigator.vibrate`) on attendance taps and voice confirmation.
   Zero occurrences today, in an app whose main job is one-tap attendance
   outdoors in winter.
5. **Charts on tokens** — fix `rating-chart.tsx`'s invalid
   `hsl(var(--border))`, and audit `analytics/position-pie-chart.tsx` and
   `analytics/rating-trend-chart.tsx`. Read the `dataviz` skill first.
6. **Streaming skeletons** replacing the blocking "Analysing academy data…"
   once P2 lands streaming.

---

## Part 9 — Verification

Every step, in this order:

```bash
cd web
rm -f tsconfig.tsbuildinfo      # mandatory when a Server Action's type changes
npx tsc --noEmit
npm test                        # baseline is EXACTLY 2 known failures:
                                #   src/__tests__/validation.test.ts
                                #   src/components/__tests__/logo.test.tsx
npx eslint
GEMINI_API_KEY=dummy NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy \
npm run build
npm run test:e2e                # for anything touching routing or the shell
```

A third Jest failure means this work caused it.

Jest note: a component that transitively imports an actions file needs the
`next/cache` mock, and anything reaching `@google/genai` needs a module mock —
`tactical-board.test.tsx:9` is the worked example, and `jest.setup.ts` carries
the `TextEncoder`/`TextDecoder` polyfill for the same reason.

### Cannot be verified without a live Supabase project

Carry these forward in `MIGRATION_RUNBOOK.md`'s 045 section as explicitly
outstanding:

- A player `SELECT` returns **only** their own `development_plan_shared` rows
  and **never** a `development_plan` row. **This is the safeguarding
  boundary** — it is the single most important check in the list.
- A parent sees only their linked child's; a coach in another academy sees
  nothing.
- `approveDevelopmentPlan`'s two-row write lands under `ai_artefacts_staff_all`'s
  `WITH CHECK`.
- Erasure: delete a seeded player, confirm zero surviving `ai_artefacts` rows.
- Whether a parent's `profiles.academy_id` is in fact populated in this
  academy's real data — the whole parent view depends on it.

The **local PostgreSQL 16 harness** in `MIGRATION_RUNBOOK.md`'s "Reproducing
this verification" section *can* prove the policy shapes without Supabase and
should be used for 045 — `041` skipped it and its own header says so
regretfully.

### Cannot be verified without a Gemini key

- Whether the model honours each `responseSchema` for the new shapes.
- Whether 1400 output tokens is enough for 2–3 focus areas + 3–4 actions + two
  notes + the verdict. **The truncation failure mode is silent.**
- Whether `previous` is grounded in the real completions rather than invented. A
  pre-computed diff in the brief plus `COACH_SYSTEM`'s "never invent a
  statistic" is the mitigation, but only live output proves it.
- Whether `playerNote` stays non-negative under adversarial input (see 1.7).
- `usageMetadata`'s real field names.

### Known risks

| Risk | Mitigation |
|---|---|
| Fingerprint non-determinism → cache never hits, bill unchanged, no symptom | Sort everything in the builder; determinism unit test |
| Fingerprint changes daily from the rolling attendance window → TTL unused | Bucket the window start to a fixed boundary |
| `development_plan_shared` drifting to carry the full plan → a child reads the coach's private concern | `toPlayerSafePlan` returns a distinct type, so the wrong object won't compile; plus the explicit test |
| `cn()` dropping one of two `bg-*` classes | Never `cn()` a `fill` next to another `bg-*`; assert the class in the render test |
| Missing-table error surfacing as a hard failure | `isMissingAiArtefactsTable` catches `PGRST205`/`42P01`, which `isMissingAttributeColumn` does not |
| POPIA: erased player's AI profile surviving | `player-erasure.ts` updated in the **same** PR as the migration |
| Streaming + tool use relaxing `thinkingBudget: 0` → silent truncation | Scoped to the agent only; watch for answers stopping mid-sentence |

---

## Part 10 — Decisions needed, and docs to update

### Needs a call from the product owner

1. **The feature list in Part 3** — particularly the three `DECIDE` items:
   video → board (3.2e), the coach CPD log (3.4e), and whether the two
   `NO for now` items (Skills Challenge, tightening
   `academy_members_read_completions`) should move.
2. **The consent gate** — Phase 5's prerequisite. Somebody has to read the
   current consent form and confirm what it permits. This is the only item here
   that can't be done in a session, and the highest-value phase sits behind it.
3. **Design changes**: five `--color-dev-*` tokens, an `AiPanel` primitive, a
   `color` prop on `StatBar`, a `Spinner` primitive, app-wide `EmptyState`
   adoption, minimal CSS motion, haptics. No new shell, no new type scale, no
   reopening of the three declined directions.
4. **Phase 0 ships immediately** regardless — it's a live defect.

### Docs to update as phases land

- `BACKLOG.md` — new phase entries; **renumber 5.0 and 5.4's migration
  references to 046+** (043 and 044 are taken).
- `MIGRATION_RUNBOOK.md` — backfill 042–044, add 045 and its
  graceful-degradation contract and outstanding live checks.
- `web/CLAUDE.md` — missing-*table* vs missing-*column* error codes; `profiles`
  invisible to player and parent; fingerprint determinism; the streaming
  thinking-budget exception.
- `AI_FEATURES_AND_IA.md` — Part 1 gains the tactics/video/performance leaders;
  Part 2 gains the agent, voice capture, the board features and the family
  layer, all of which postdate it.

## Sources

Market scan, 2026-10-01. `AI_FEATURES_AND_IA.md`'s own source list still
applies for StepOut, Veo, Trace, CoachFrank, Coach OS, aiScout, Upstar,
DribbleUp and the fair-playing-time apps.

- [Gemini video understanding](https://ai.google.dev/gemini-api/docs/video-understanding) · [agentic video mode](https://www.vp-land.com/stories/gemini-apis-agentic-video-mode-navigates-long-footage-instead-of-sampling-the-whole-clip)
- [TacticalPad 2026](https://docrack.me/en/tacticalpad-2026-coaching-app-guide/) · [Football apps for coaches 2026](https://www.vantasports.ai/blog/football-apps-for-coaches) · [Football video analysis software](https://english-programs.sportsdatacampus.com/football-video-analysis-software/)
- [FM26's new AI coach algorithm](https://www.footballmanagerblog.org/2026/01/fm26-new-ai-coach-algorithm-forces.html) · [Barça Innovation Hub — AI and computer vision in football](https://barcainnovationhub.fcbarcelona.com/blog/ai-computer-vision-football-analytics/)
- [SkillCorner $60M raise](https://youthsportsbusinessreport.com/skillcorner-secures-60-million-to-expand-ai-powered-sports-tracking-across-north-america/) · [SkillCorner open data](https://github.com/SkillCorner/opendata) · [Playermaker](https://www.playermaker.com/)
- [CoachAI tools comparison 2026](https://www.coachai.uk/blog/best-ai-football-coaching-tools-uk-2026) · [Hobbit — best soccer coaching apps](https://hobbit.football/tools/best-soccer-coaching-apps) · [FootballGPT](https://footballgpt.co/football-ai)
- [PlayerUp IDPs](https://www.playerup.co/solutions/individual-development-plans) · [FlickTec — what is an IDP](https://flicktec.io/blog/what-is-individual-development-plan-idp-youth-soccer)
- [ACWR load-management trial in elite youth football](https://clinicaltrials.gov/study/NCT07727382) · [Serie A youth microcycle periodisation](https://www.researchgate.net/publication/383304430_Training_loads_and_microcycle_periodisation_in_Italian_Serie_A_youth_soccer_players)
- [Speakwise — how coaches record sessions](https://speakwiseapp.com/blog/how-sports-coaches-record-practice-sessions)
- Open-source single-camera pipelines, for why this is not the route: [football_analytics_cv](https://github.com/Smithaker10/football_analytics_cv), [Football-Analysis-System](https://github.com/AmmarMohamed0/Football-Analysis-System)
- On-device skill scoring, for context on 3.5d: [Worldkick](https://play.google.com/store/apps/details?id=app.foxyfitness.android.worldkick), [AthletixAI](https://github.com/manthandhanraj/AthletixAI)
