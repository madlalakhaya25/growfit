# Product Strategy 2026–27

*Written 2026-10-06 from Khaya's master product brief (about 80 sections plus a 28-section
Partnerships, Sponsorship and Funding brief), an audit of this repository at
`785d800` (#120), and eight research topics in [`docs/research/`](./research/).
This is the source of truth for **what to build and why**. [`ROADMAP.md`](./ROADMAP.md)
and [`BACKLOG.md`](./BACKLOG.md) record what is built and the near-term order.*

Labels used below: **FACT** (checked in the repo or a cited source),
**FINDING** (from research, with a source in `docs/research/`), **INFERENCE**,
**HYPOTHESIS** (to test), **DECISION** (made by Khaya), **RECOMMENDATION**.

---

## 1. Decisions made (2026-10-06)

| # | Decision |
|---|---|
| 1 | First vertical slice is **Match → Training → Follow-up** ([spec](./FEATURE_SPECS/match-to-training.md)). |
| 2 | Payments, a talent marketplace and in-app messaging stay **non-goals**. |
| 3 | "Develop, Operate, Grow" is **tested, not adopted** (result in section 6). |
| 4 | Research is limited to the **8 topics that can change a decision**, not a 30-part pack. |
| 5 | A separate user-docs site (Docusaurus) waits until a **second academy** joins. |
| 6 | The Grow (funding) layer stays **off the build list until a named person** can verify tax, B-BBEE and POPIA wording. |
| – | Academy-in-a-box: build the **configurable core** now (the academy's own competency list by age group, filled in by Buhle for Growfit FA). Growfit FA's setup is the first template. More templates come when a different academy joins. |
| – | Gemini stays on the free tier until official roll-out at scale; the risk is accepted and recorded in section 4. |
| – | Plan before implementation: every slice gets a spec in `FEATURE_SPECS/` and Khaya's approval first. |

Standing project rules still apply. Nothing reaches a child or parent unreviewed, a coach
approves all AI output, Gemini only, Buhle approves consent and preset wording,
production migrations are agreed first, and the work ships one PR per step.

---

## 2. What the brief is really asking

**INFERENCE.** The brief's real acceptance test is its section 75: each role can
answer its own question from evidence.

| Role | Question | Today |
|---|---|---|
| Administrator | What needs attention today? | Yes (Admin Today) |
| Coach | What should I work on next? | Partly. Matches don't feed training |
| Player | How am I developing? | Partly. Scores and activity, not change |
| Parent | What is my child developing? | Partly. Weekly, not linked to training |
| Scout | What evidence do I have? | No |
| Technical director | Are we developing to our method? | No. The method is not stored |
| Academy director | Is the academy getting better? | No. There is no season view |
| Owner | Is Growfit making us better? | No |

The four "no" rows share one cause. Growfit records **activity** but does not store
**intent** (what we meant to develop) or **outcome** (whether it worked) as data it
can query.

---

## 3. Five building blocks under the whole brief

**RECOMMENDATION.** Nearly every feature in the brief, including most of the funding
layer, is one of five blocks seen by a different audience.

| Block | Serves | State today (FACT) |
|---|---|---|
| **Evidence**: who saw what, about whom, when, from what source, how sure, who may see it | Observations, match events, self-assessment, scout and coach observation, voice debrief, provenance, development proof, sponsor impact evidence | Spread across ratings, coach notes, self-assessments, welfare, effort and AI artefacts, with no shared source or confidence field |
| **Objective**: a target with an owner, a timeframe, a competency, evidence and a verdict | IDP, player goals, match-to-training, coach goals, fundable-project outcomes, development debt | Plan focus areas live inside `ai_artefacts` JSON with free-text area names, so they can't be counted |
| **Competency framework**: the academy's own list of what it develops, by age band | Game model, curriculum, coverage, assessment, scouting, coach-observation dimensions, maturity index | Three separate lists: 5 milestone categories, 6 drill categories, 30 attributes. None is configurable |
| **Review cycle**: a scheduled look back with approval and a locked version | Term and season review, IDP review, trial decision, AI approval, external proposal approval | Built separately for each feature |
| **Audience report**: an approved summary, every number linked to its source, for one audience | Family note, development receipt, academy pulse, sponsor impact report, media kit, benchmarking | Family note, term report, match story and Today homes are good patterns |

Two pieces cut across all five blocks: an **audit log** (none exists today) and
**visibility scopes** (coach, parent, player, scout, sponsor). The architecture stays a
Next.js and Supabase monolith with RLS, using relational tables. pgvector is added only if
retrieval proves useful. No graph database and no microservices.

**Order follows dependencies.** The first slice creates Objective and Evidence from data
coaches already enter. The review cycle and the competency framework come next. Audience
reports follow, and the funding layer comes last because its unique value, an impact
report built from real data, is an audience report.

---

## 4. What the research changed

Full findings, labelled and sourced, are in [`docs/research/`](./research/).

### Must act on now

- **FACT: Gemini terms.** On the free tier, Google uses prompts to improve its
  products and human reviewers may read them. The terms say not to send personal
  information. Both the Gemini API terms and the Google Cloud (Vertex AI) terms forbid
  use in a service "likely to be accessed by individuals under the age of 18"
  ([Gemini API terms](https://ai.google.dev/gemini-api/terms), updated 2026-04-28;
  [Google Cloud Service Specific Terms](https://cloud.google.com/terms/service-terms)
  §20(d)). Players log in to Growfit. Player pages make no AI calls (FACT, repo).
  **DECISION (Khaya, 2026-10-06):** stay on the free tier for now and turn on
  billing at scale, for the official roll-out. This is a known, accepted risk
  while Growfit serves only its own academy.
  **RECOMMENDATION** for the meantime, at no cost:
  1. Turn on paid billing before the official roll-out or a second academy.
  2. Send only first names or pseudonyms in prompts.
  3. Get a legal read on the age clause before adding AI features.
  4. Keep AI fully off player and parent surfaces until that read is done.
- **FINDING: POPIA basics with real enforcement.** The Regulator fined the
  Department of Basic Education R5m in December 2024. Cheap high-value steps:
  - Register an Information Officer.
  - Write a breach-response plan.
  - Check whether children's and health data hosted offshore (Supabase, Vercel, Google)
    needs the Regulator's prior authorisation under s57, or signed agreements under
    s72.
  - Keep AI plans advisory under s71.
  - Share only aggregates with sponsors, hiding groups smaller than 5.
  - Ask for a separate parental opt-in for photos and video.

### Football development

- **FINDING.** SAFA publishes no current U11–U15 curriculum (its Vision 2022 and
  2018 philosophy are dated). Ship a default competency framework built from the
  existing 5 categories and 30 attributes, with an `age_band` on every item, and let
  the academy remap it.
- **FINDING.** Football Australia's "football problem" loop is the template for the
  first slice.
- **FINDING.** For readiness:
  - No ACWR.
  - Use attendance, minutes and a "pain today?" check that blocks "ready".
  - Measure height each term and flag growth of 7.2 cm or more a year.
  - Use effort ratings only from U13.
- **FINDING.** Relative-age bias is strong. Show birth quarter next to ratings, and never rank
  players by one composite score.
- **FINDING.** Enjoyment and playing time drive retention. Surface "low minutes and falling
  attendance" next to the 75% welfare trigger.
- **FINDING.** Store coach licences (SAFA D → C → B → A → Pro) with dates, along with
  CPR Part B. CAF club licensing expects a child safeguarding officer, which supports
  filling the open seat.
- **FINDING.** MYSAFA stays the source of truth for registration. Growfit links
  to it and does not copy it.

### Market and competitors

- **FINDING.** Scheduling, attendance and messaging are commodity, and free (Spond, TeamSnap
  free tier). Elite tools cost far more than an SA academy can pay (Hudl from about
  $500 per team per year). No SA academy platform was found.
- **FINDING.** AI development plans exist elsewhere, but built from video or player
  self-report. **OPPORTUNITY:** coach-approved plans from records the academy
  already keeps, a welfare trigger, a parent view specific to each child, and a
  low-data design that works alongside WhatsApp.
- **FINDING.** The main constraint is money (a DUT study of 11 eThekwini academies,
  2021). 1GB of data costs R25 a day to R79 a month, about 67% of adults own a smartphone,
  and 94–96% of internet users are on WhatsApp.
- **INFERENCE.** Academies may pay R0–300 a month at most, so the payer may be a
  funder, federation or sponsor rather than the academy.

### Language, offline, WhatsApp

- **FINDING.** In KwaZulu-Natal, 80% speak isiZulu most at home (Census 2022). Ask each
  parent's language at registration. Use a professional translation for consent,
  safeguarding and medical templates. Machine translation, with coach review, is fine
  for routine messages.
- **FINDING.** For offline, use an IndexedDB queue plus a service worker. Don't rely on
  Background Sync, which most browsers lack. Consider PowerSync later.
- **FINDING.** WhatsApp: default to `wa.me` share links from the coach's own phone. The
  official API needs approved templates and recorded opt-in, and should message guardians only.

### Funding (Grow)

- **FINDING.** Corporate social investment in SA was R13.1bn in 2025, but sport
  received about 2% of it and education 44%.
- **FINDING.** B-BBEE socio-economic development can count sporting development. It
  needs at least 75% black beneficiaries, which means collecting race data, and that is
  special personal information.
- **FINDING.** Sport is in Part I but not Part II of the Ninth Schedule, so
  **donations for sport are probably not 18A-deductible**. A route may exist through
  educational enrichment, with SARS approval. Sponsors who receive branding are
  invoiced, not given 18A receipts.
- **FINDING.** Turning operational data into impact reports already exists in the UK
  (Upshot, Plinth). None sits inside a football workflow or serves SA. SA donation
  tools (BackaBuddy, GivenGain) are cheap. Link to them rather than build payments.

---

## 5. Revised roadmap

| Horizon | Items |
|---|---|
| **NOW** | Pseudonymised prompts and a legal read on the Gemini age clause. Paid Gemini billing at official roll-out (decided 2026-10-06). Information Officer and breach plan (Khaya, admin). **Match → Training → Follow-up** slice. Audit log. |
| **NEXT** | Competency framework v1 with age bands (Buhle reviews the default). Player IDP objectives moved onto the Objective table. Readiness v2 (pain flag, growth, retention risk, no ACWR). Coach passport (licences, CPR Part B, first aid). Birth quarter on squad views. Parent language preference. |
| **LATER** | Development coverage and debt. Season learning review. Academy Pulse. Offline match events and observations. Professional isiZulu consent templates. WhatsApp templates via share links. Scouting observations and trials. User docs site (second academy). |
| **FUTURE** | Grow starter (profile, fundable project, contribution log, impact report), once a verifier is named and funder interviews support it. Computer vision. Opportunity engine. Benchmarking across academies. Sponsor portal. |
| **DO NOT BUILD** | Advertising. Payments. Public child rankings or one-number player headlines in child and parent views. ACWR for youth. AI predictions of potential. A generic sponsor CRM. A native app rebuild. All six Academy-in-a-box templates at once. |

---

## 6. Positioning test (decision 3)

**HYPOTHESIS tested:** "Growfit is an Academy Growth OS that helps academies
Develop, Operate and Grow."

**RECOMMENDATION: do not adopt it as the headline.** Sport gets about 2% of SA corporate social
investment, sport donations are probably not 18A-deductible, and impact-report tools
already exist, so "Grow" promises the weakest and least proven part (R1-R5, R4-R6).
Lead with football development, and keep "Grow" as a later benefit of the same
evidence.

**Working line:** *Growfit turns what your coaches already do into evidence of how
every player is developing, for coaches, parents and, later, the people who fund you.*

**Moat (HYPOTHESIS, plausible but unproven).** The impact report itself is easy to copy.
Any defensibility comes from three things:
- coaches capturing data out of habit inside the football workflow;
- fit with SA compliance (POPIA, MYSAFA, SAFA pathways);
- a dataset that builds across academies over time.

Test it with 3–5 academy interviews and 2–3 funder interviews (guide in
[`research/R4-R6-competitors-and-market.md`](./research/R4-R6-competitors-and-market.md)).

---

## 7. Measurable budgets (proposed targets)

Core Web Vitals thresholds are Google's "good" levels. The rest are proposed targets,
measured at the 75th percentile on a mid-range Android phone over 4G.

| Measure | Target |
|---|---|
| Largest Contentful Paint | ≤ 2.5 s |
| Interaction to Next Paint | ≤ 200 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| First-load JS per route (gzip) | ≤ 170 KB, board pages excepted |
| Server action / API response time (95th percentile, excluding AI) | ≤ 500 ms |
| AI draft returned | ≤ 10 s, with a visible progress state |
| Page weight on a Today home | ≤ 500 KB transferred |

---

## 8. Red team

| Risk | Change made to the plan |
|---|---|
| Volunteer coaches won't type more | Every new record is a by-product of an existing step or takes one tap, and is always skippable |
| Feature sprawl | One slice at a time. Each brief item is classified, and many are FUTURE or DO NOT BUILD |
| AI unsafe with children, or against provider terms | Pseudonymised prompts now, paid tier at roll-out, a legal read, and AI kept off child and parent surfaces |
| Grow makes a wrong tax or B-BBEE claim | Off the build list until a verifier is named. Wording is always "may be relevant, verify with your adviser" |
| The product suits only one academy | Configurable competency framework and interviews before Grow spending |
| No one pays | Price for funders or federations, not only academies (INFERENCE, to test) |

---

## 9. Working state

The full working state (assumptions, open questions, rejected ideas) lives in the
project's shared files at `strategy/working-state.md`. The human-readable plan is
the "Growfit Audit and Plan" page. Update both when a decision changes.
