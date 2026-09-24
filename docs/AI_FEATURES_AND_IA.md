# AI Features and Information Architecture

*Written 2026-09-24, prompted by seeing StepOut (an AI football
performance-analysis product) and asking two questions: what else in the
AI-driven football-app market is worth stealing, and is Growfit's own
navigation already too cluttered to add more to.*

This document has four parts: a market scan, the features it suggests,
the safeguarding rules a video feature needs, and the navigation/design
changes that make room for all of it without the app feeling more
crowded. It follows `FEATURE_PROPOSALS.md`'s format — problem, upgrade,
cost — and the same constraint runs through it: the academy is three
volunteers. Nothing here should need daily maintenance to keep running.

---

## Part 1 — Market scan

One row per product. **Verdict** is adopt (build the equivalent),
adapt (build a cheaper version with Gemini, the model already in this
stack), or skip (not worth it for a grassroots academy on phone
footage).

### Match video analysis

| Product | What its AI does | Verdict |
|---|---|---|
| **StepOut** (TMS + player app) | Automated event detection and tagging, heatmaps, passing networks, vector maps, a "Spotlight" tagged-clip library; player app shows stats, highlights, performance curves. Needs 1080p footage with visible jersey numbers; charges academies about €40–100 per match. | Tagging and highlights: **adapt**. Heatmaps/passing networks: **skip** — they need fixed-camera, whole-pitch tracking a phone can't give. |
| **Veo** (Player Spotlight) | Shirt-number detection tracks a player through a match and compiles their moments into an individual highlight reel automatically. | **adapt** — same idea, coach-tagged instead of auto-tracked. |
| **Trace** | Per-player highlight reels plus livestreaming. | **skip** livestream (out of scope per ROADMAP non-goals), **adapt** highlights. |

### AI session planning

| Product | What its AI does | Verdict |
|---|---|---|
| **CoachFrank** (Player Development Project) | Free session plans generated in under 60 seconds from coaching research. | Growfit already has a session generator (`session-generator.ts`). **Adopt** the missing pieces: diagrams and real constraints. |
| **Coach OS** | Adapts sessions to age, field conditions and available time, from 850+ youth exercises. | **adopt** — constraint-aware generation. |
| **MyCantera, Hobbit AI, Sportlingo** | Age-scaled sessions with drill diagrams; Hobbit also writes the parent-facing layer from real team data. | **adopt** diagrams; parent-facing writing already exists (`parent-report.ts`). |

### Phone-camera skill tracking

| Product | What its AI does | Verdict |
|---|---|---|
| **aiScout** (ai.io) | Players record themselves doing drills; AI scores them from 22 tracked body segments. Used by Premier League and MLS academies for talent ID. | **adapt** — a lighter, rubric-based version, not pose estimation. |
| **Upstar** | A drill clip is scored against a defined skill rubric; feedback is simple and age-friendly. | **adapt** directly — this is the shape of "Skills Challenge" below. |
| **DribbleUp, Techne** | Juggle counting and ball-mastery challenges via camera + smart ball. | **adapt** the counting idea; skip the smart-ball hardware. |

### Fair playing time

| Product | What its AI does | Verdict |
|---|---|---|
| **Pitch Planner, SubTime, FairPlayTime** | Generate a substitution schedule that balances minutes across the roster; live sub timer for matchday. | **adopt** — deterministic scheduling, not AI, is the right tool here, but the idea (and the touchline timer) is worth building. |

### Growth, maturation and load (sports-science research, not a product)

Physeal (growth-plate) injuries in academy football peak around U14 —
directly inside Growfit's U13/U15 range. Bio-banding and session-RPE
(a player's own 1–10 effort rating × session duration) are the two
practical, low-tech ways academies track this without wearables.
**Maturo** is a startup applying computer vision/ML to this; not
something to replicate, but its problem statement (growth and load as
a standing input to squad decisions) is directly relevant.
**Verdict: adopt** the low-tech version — height by term, RPE per
session, and a simple load-spike flag.

### Talent discovery

| Product | What its AI does | Verdict |
|---|---|---|
| **aiScout, ScoutR** | Scouts filter and discover players by drill scores or stats. | Already on `ROADMAP.md`'s long-term list as an opt-in talent marketplace. **No change** — stays gated on consent, stays long-term. |

### Explicitly skipped

Heatmaps, passing networks, and tracking every player at once all
need a fixed, wide-angle camera with continuous multi-player tracking.
A coach's phone clip — one angle, usually following the ball — cannot
support any of them credibly. Building a "heatmap" from that footage
would be decoration, not data.

---

## Part 2 — Proposed features, ranked

Every feature reuses what already exists rather than building parallel
plumbing: `squad-context.ts` builds the real-data brief for every AI
call, `ai-guard.ts` handles rate limiting and error messages, and
`ai-models.ts` picks the model tier (`AI_MODEL`, `AI_MODEL_DOC`,
`AI_MODEL_LITE`).

### Now

1. **Apply buttons.** Thirteen AI features return prose today; none of
   it can be acted on. A suggested XI should fill the fixture's squad
   selection (skipping any player marked `availability_status =
   'injured'`, migration 039); a generated session should save as a
   draft `training_session`; a match plan (already stored per
   migration 041) should have a "use this plan" action. This is
   already `FEATURE_PROPOSALS.md` #4 and the single largest jump in
   usefulness available for the least new surface area.
2. **Fair game-time planner.** *(Pitch Planner, FairPlayTime.)*
   Growfit has no minutes-played field. Add one, and a deterministic
   (not AI) rotation algorithm that balances a season's minutes and
   respects injuries — the AI's job is only to explain the plan in
   words. Pairs with a live sub timer on the matchday screen.
3. **Voice match log.** The tactics board already has a voice-note
   recorder (`voice-note-recorder.tsx`). Point the same capture at
   Gemini after a match: a coach narrates the score, scorers, subs
   and cards, and it prefills the result-logging form for the coach
   to confirm — turning the slowest part of a coach's Sunday evening
   into thirty seconds of talking.
4. **Post-match parent recap.** A one-tap, warm, WhatsApp-ready recap
   generated the moment a result is logged, in English or isiZulu.
   Never singles out a child negatively. This is the cheapest way to
   make the academy look like an institution to a parent, per
   `FEATURE_PROPOSALS.md` #5's reasoning about term reports.

### Next

5. **Constraint-aware sessions with diagrams.** *(Coach OS, Hobbit,
   MyCantera.)* A coach names what they actually have — "14 kids, 8
   cones, half a pitch, 60 minutes, focus: pressing" — and gets a
   session with a diagram per drill, drawn on the existing tactics
   board renderer (`board-model.ts`, `board-render.ts`), not just
   prose.
6. **Half-time assistant.** Twenty seconds of half-time voice notes
   become three talking points and a suggested substitution, drawing
   on the rotation plan from #2. Read aloud via the existing
   `speak-button.tsx`, for a coach whose hands and eyes are on the
   touchline, not a screen.
7. **Welfare radar, plus growth and load watch.** The welfare
   check-in system (`welfare_checkins`, triggered today only by the
   75% attendance threshold) gets three more inputs: falling
   attendance trend, falling ratings, and — new — a load-spike flag
   from session-RPE, and a rapid-growth flag from termly height
   entries. Height is health data under POPIA and stays coach-only.

### Later

8. **Performance curves, best-suited position, opponent memory.**
   Trend charts over ratings/attendance/milestones (built on the
   existing `rating-chart.tsx`) with an AI narrative underneath; a
   coach-only "best-suited position" suggestion from attributes and
   ratings; and feeding past GDFL results against the same opponent
   into the existing tactical counter-analysis.
9. **Consent-gated Clip Coach and "My Moments."** *(StepOut Spotlight,
   Veo Player Spotlight.)* A coach uploads a short phone clip. Gemini
   returns timestamped, tagged moments and three coaching points; the
   clip itself is never stored — see Part 3 for why this has to be a
   later feature, not a now one. Approved moments surface on the
   player's passport the same way Veo surfaces individual highlight
   reels.
10. **Skills Challenge.** *(aiScout, Upstar, DribbleUp.)* A weekly
    home drill; the player's clip gets rubric feedback and an
    approximate touch/juggle count, approved by the coach before the
    player sees it. Private progress only — no leaderboard, which
    stays a stated non-goal.
11. **Term reports and isiZulu.** An AI-written term summary on the
    existing `print/term-report` page, and an on-demand translation
    toggle for announcements and parent reports (lite model) — a
    down payment on the i18n work `ROADMAP.md`'s long-term section
    already flags as compounding in cost the longer it waits.

---

## Part 3 — POPIA and safeguarding rules for video

These apply to Clip Coach and Skills Challenge, and have to be in
place before either ships — they are the reason video is a *later*
feature, not a now one.

- **Consent first.** A clip can't be analysed unless every player it
  shows has photo/media consent on file (`player_consents`). The
  upload path checks this and blocks otherwise.
- **No storage.** The clip is sent to Gemini's Files API for analysis
  and deleted immediately after (`finally`), never written to
  Supabase Storage. Growfit's stated non-goal is "no video
  hosting" — this respects it because Growfit never becomes a video
  host, only a temporary conduit to an existing provider.
- **Cross-border transfer.** Gemini's paid tier (already in use for
  document understanding) doesn't train on submitted data, which is
  the relevant guarantee under POPIA §72 for data leaving South
  Africa.
- **No biometric identification.** Players are tagged in a clip by
  the coach, or by jersey number — never by face recognition. This
  keeps `ROADMAP.md`'s "no custom AI/ML, e.g. automated attribute
  scoring from video" non-goal intact even as clip *analysis* (not
  scoring) is added.
- **A coach approves before a player sees anything.** Every piece of
  AI-generated feedback about a child passes through an adult first.

**Proposed rewording of `ROADMAP.md`'s Non-goals**, since the current
wording reads as blocking this entirely:

> - **Video hosting/transcoding** — link out, don't host. Ephemeral,
>   delete-after-analysis clip review via the existing AI provider
>   is not hosting and is in scope.
> - **Custom AI/ML** (e.g. automated attribute scoring from video, or
>   face recognition) — still out of scope. A general-purpose model
>   reading a short clip and returning a coaching note is not custom
>   ML in this sense.

---

## Part 4 — Navigation and design

### The clutter problem

Coaches currently have six flat nav items (`Overview, Squad, Fixtures,
Training, Tactics, Announcements`), and several real pages have no
nav entry at all — the AI assistant is reachable only from Tactics,
Welfare only from a link on the dashboard, and two admin pages
(`analytics`, `development`) aren't linked from navigation at all.
Adding sixteen more features on top of that flat list, unchanged,
would make the app worse, not better.

### The fix: sections, not more tabs

Group the existing routes (URLs don't change) into a small number of
sections per role, each with its own `SectionTabs` for what's inside
it:

| Role | Sections |
|---|---|
| Coach | **Today** — **Matchday** (Fixtures · Results · Film) — **Squad** (Players · Welfare · Emergency) — **Develop** (Sessions · Drills · Tactics) — **More** (Posts · Assistant · Settings) |
| Player | **Passport** — **Schedule** (Matches · Training) — **Learn** (Plays · My Moments · Development) — **Posts** |
| Parent | **My Children** — **Fixtures** — **Posts** *(unchanged — already the right size)* |
| Admin | **Overview** — **People** (Players · Teams · Import) — **Compliance** (Documents · Reports) — **Insights** (Analytics · Development · Academy health) — **Academy** |

Every orphaned page (assistant, welfare, admin analytics, admin
development) gets a real home in this structure instead of being
reachable only by a lucky click.

### One AI entry point, not AI scattered everywhere

Pure explainers (`TacticalConceptPanel`, `PositionalRolePanel`) move
into a single **"Ask Growfit"** button, open on every coach/admin
page, that opens the existing coach-assistant chat with the current
page's context attached. An inline AI panel stays on a page only when
its output can be **applied** right there — the match report on a
fixture, the session generator on a training page. This is the same
rule that makes the Apply-buttons feature (#1 above) worth doing: AI
that finishes the job stays close to the job; AI that only explains
moves to one place.

### Per-academy feature toggles

A `jsonb` column on `academies` lets a club switch off what it
doesn't use (Tactics, Film, Clip Coach), so the nav a small academy
sees stays as short as what it actually runs.

### Visual direction: "Matchday"

The UI today uses a generic, cool-toned admin-dashboard look — Geist
font, zinc greys, icons in tinted squares, dashed empty states — and
barely uses the crest (red/black/white shield) or the player headshots
already stored. The redesign:

- **Type:** Barlow Condensed for titles, scorelines and jersey
  numbers; Barlow for body text; tabular numerals throughout.
- **Colour:** crest red (`#A71817`) stays primary; a new dark **ink**
  tone for hero bands; warm paper/stone neutrals replace cool zinc.
- **Shape:** a shield clip-path for avatars and crests; tighter
  radius; fewer borders, more hairline dividers — the page itself is
  the surface, and a card is used only for something that really is
  a distinct object.
- **New primitives:** `PageHeader`, `SectionTabs`, `ListRow`,
  `PlayerAvatar` (headshot in a shield with a jersey-number badge),
  `Scoreline`, `FixtureTicket`, `Sheet` (bottom sheet on mobile, side
  panel on desktop), `InfoTip` (explanatory copy tucked behind a "?").
- **Copy:** short, second-person, sounds like a coach — no
  "AI-powered" labelling, no paragraphs explaining the UI.

### Worth saying no to

- **Heatmaps/passing maps from phone footage** — see Part 1; the data
  doesn't support the claim.
- **Face recognition** — see Part 3.
- **A parent-facing leaderboard, or ranking Skills Challenge scores**
  — unchanged from `FEATURE_PROPOSALS.md`'s existing "worth saying no
  to" list, and doubly true once children's own skill videos are
  involved.
- **Live match tracking, video hosting** — unchanged `ROADMAP.md`
  non-goals; clip *analysis* is not either of these (Part 3).
- **A second, separate app per audience.** One app, reorganised into
  focused sections, gets the same decluttering benefit for a fraction
  of the maintenance cost a 3-volunteer academy can carry.

---

## Suggested build order

1. Design system + navigation rebuild — makes room for everything
   after, without which every new feature adds to the same flat list.
2. Apply buttons, fair game-time planner, voice match log, parent
   recap — the highest ratio of usefulness to new surface area, and
   none of them need the video consent gate.
3. Constraint-aware sessions, half-time assistant, welfare/load watch.
4. The consent gate, then Clip Coach, My Moments, Skills Challenge.
5. Term reports and isiZulu.

## Sources

- [YourStory — How StepOut is democratising football analytics](https://yourstory.com/2025/05/sports-tech-startup-stepout-democratising-football-analytics)
- [Prodwrks — StepOut and Europe's top clubs](https://prodwrks.com/indias-stepout-has-an-ai-for-performance-analysis-in-football-europes-top-clubs-are-buying-in/)
- [StepOut](https://www.stepout.ai/en/)
- [StepOut — Google Play](https://play.google.com/store/apps/details?id=com.sports.performance.analysis.stepout&hl=en_US)
- [Veo — Player Spotlight](https://www.veo.com/product/player-spotlight)
- [Veo — soccer camera systems compared, 2026](https://www.veo.com/article/soccer-camera-systems-compared)
- [LevelUp.soccer — Veo vs Hudl vs Trace](https://levelup.soccer/learn/veo-vs-hudl-vs-trace)
- [Trace for soccer academies](https://traceup.com/soccer/academy)
- [CoachFrank — App Store](https://apps.apple.com/us/app/coachfrank-soccer-training-ai/id6479705308)
- [Coach OS — Google Play](https://play.google.com/store/apps/details?id=com.coach.os.coachos&hl=en_US)
- [Hobbit AI — best soccer coaching apps 2026](https://hobbit.football/tools/best-soccer-coaching-apps)
- [MyCantera — best AI tools for soccer coaches 2026](https://mycantera.com/blog/best-ai-tools-soccer-coaches-2026)
- [Sportlingo — best youth soccer coaching app](https://sportlingo.ai/blog/best-youth-soccer-coaching-app/)
- [CNN — aiScout, top clubs scouting future stars](https://www.cnn.com/2024/03/01/tech/aiscout-app-soccer-scouting-spc-intl)
- [Youth Sports Business Report — ai.io x MLS](https://youthsportsbusinessreport.com/ai-ios-ai-talent-discovery-app-reaches-45000-youth-athletes-through-mls-partnership/)
- [ScoutR](https://scoutersports.com/)
- [Tezeract — Upstar AI soccer training case study](https://tezeract.ai/ai-case-studies/upstar-automated-soccer-training-app/)
- [Sports Technology Blog — DribbleUp review](https://sportstechnologyblog.com/2019/02/08/dribbleup-soccerfootball-app-review/)
- [Cybernews — 7 best soccer training apps 2026](https://cybernews.com/health-tech/best-soccer-training-apps/)
- [Pitch Planner](https://pitch-planner.app/)
- [SubTime](https://www.subtimeapp.com/)
- [FairPlayTime — App Store](https://apps.apple.com/us/app/fairplaytime/id6748342747)
- [Growth and maturation assessment in youth sport (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13481284/)
- [Reducing injury risk during the adolescent growth spurt (Taylor & Francis)](https://www.tandfonline.com/doi/full/10.1080/03014460.2023.2261854)
- [ML-predicted recovery in sub-elite youth footballers (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12732887/)
