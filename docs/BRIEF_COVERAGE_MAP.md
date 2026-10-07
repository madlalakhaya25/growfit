# Coverage map: every section of the master brief

*Written 2026-10-06 after Khaya asked what was missed. One status per section. Statuses: **Built** (in the app), **Partly** (some of it exists), **Planned** (approved or in the current plan), **Researched** (findings written, nothing built), **Deferred** (on purpose, with a trigger), **Rejected** (ruled out, reason given), **Undecided** (never given a decision: Khaya to choose).*

## Part 1: the Develop and Operate brief (sections 1 to 79)

| # | Section | Status | Note |
|---|---|---|---|
| 1 | Inspect the existing product | Built | Audit page, 4 versions |
| 2, 3 | North star, core loop | Planned | `PRODUCT_STRATEGY.md`; slice is the loop |
| 4 | Research before decisions | Built | `docs/research/` (8 topics) |
| 5 | Academy development | Partly | Curriculum, pickers and coverage built; hats and director cards next |
| 6 | Academy-in-a-box | Planned | Configurable core inside the curriculum; templates later |
| 7 | Academy maturity | Undecided | |
| 9 | Academy memory | Partly | Objective history on Squad Review (needs migration 067) |
| 10, 11 | Player development system and model | Partly | Milestones, attributes, plans exist; curriculum links built |
| 12 | IDP engine | Partly | AI plans with coach approval exist; queryable objectives later |
| 13 | Player development proof | Partly | Performance curves (#93), passport |
| 14 | Player self-assessment | Built | |
| 16 | Match intelligence | Partly | Phase ratings, match story, slice |
| 17 | Smart game day | Partly | Playing-time planner (#108), lineup suggestions; rest Undecided |
| 18 | Readiness and availability | Researched | "Pain today?" check, height each term; not scheduled |
| 19 | Coach OS | Partly | Today home, week plan |
| 20, 21 | Coach passport, coach observation | Deferred | Needs CPR Part B and first-aid dates stored first |
| 22, 23 | Teach-the-coach AI, coach learning hub | Built | Think it through (#157), Learn tab with 20 lessons (#158, #159); safeguarding batch later |
| 24 | Tactical studio | Built | Tactics board |
| 26, 27, 28 | Scouting loop, trials, pathways | Deferred | After audit log and a safeguarding review |
| 29 | Opportunity engine | Rejected | Marketplace is a second product |
| 30 | Scholarship and funding | Rejected | No payments; contributions are tracked under Grow only |
| 31 | Fair playing time | Built | #108 |
| 32 | Parent OS | Partly | Parent Today home, weekly family digest |
| 33 | Parent education | Undecided | |
| 34 | Club operating system | Built | Admin area |
| 35 | Director and technical director mode | Partly | Staff hats and director and technical director cards built on admin Today (#140 to #145); scout and owner views not built |
| 36 | Academy pulse | Partly | Admin Today home; fuller pulse not scheduled |
| 37 | Academy quality assurance | Undecided | |
| 38 | Season learning review | Partly | Term review exists; season review later |
| 39 | Academy knowledge model | Rejected | No knowledge-graph database; the objectives table is enough |
| 40 | AI architecture | Built | Gemini only, answer cache, prompt cache, budget |
| 41 | Voice debrief | Partly | Dictation built; untested on a phone |
| 42 | Computer vision and video | Deferred | Consent gate in place; analysis is future |
| 43 | Connectivity, African-first | Partly | Offline attendance queue; match events, board, cache-after-sign-out gap |
| 44 | WhatsApp bridge | Partly | Share sheets and copy-ready text; no API |
| 45 | Multilingual | Researched | About 60 hardcoded English pages; not scheduled |
| 46 | Girls' football | Undecided | |
| 47 | Safeguarding | Partly | Welfare check-ins, policies; officer seat open |
| 48 | Privacy, POPIA, child data | Researched | Open for Khaya: Information Officer, breach plan, legal read |
| 49 | Competitive research | Built | R4 |
| 50 | Real grassroots research | Undecided | R6 interviews with 3 to 5 academies and 2 to 3 funders not done |
| 51 | UX and UI | Planned | Redesign done (#107, #108); `FEATURE_SPECS/experience-quality.md` steps 5 and 6 |
| 52 | Information architecture | Planned | Role homes and tabs exist; review sits in experience quality step 6 |
| 53 | Design system | Planned | Experience quality step 5: style guide and gap list |
| 54 | Accessibility | Planned | Experience quality steps 2 and 4; needs a seeded test project for signed-in screens |
| 55 | Performance | Partly | Baseline measured (`npm run measure:bundle`, #128); budgets and fixes are steps 2 and 3 |
| 56 | Architecture | Built | Reviewed in the audit; no change needed |
| 57 | Data provenance | Partly | AI artefacts labelled by kind; no source field on assessments or notes |
| 58 | Monetisation | Undecided | Your pricing question is open |
| 59 | Advertising | Rejected | |
| 60 | Sponsors and partners | Deferred | Part of Grow |
| 61 | Academy benchmarking | Undecided | Needs more than one academy |
| 62, 63 | Differentiation, moat | Built | In `PRODUCT_STRATEGY.md` |
| 64, 65 | Feature rationalisation, roadmap | Built | Audit page; roadmap pointers |
| 66 | Vertical slice | Built | Match to Training: PRs #122 to #125 and #127 merged; migration 067 still to run |
| 67 | AI cost control | Partly | Per-user budget and caching exist; no plan for scale or paid tier |
| 68 | Security | Built | The four audit debts are fixed: sign-out clears the device, erasure removes simplified notes naming the child, lint runs in CI, and players no longer read shared plays' private notes (migration 070 to run) |
| 69 | Testing | Partly | Strong unit tests; no accessibility or performance tests |
| 70 | Documentation | Built | Engineering docs, coach guide `docs/guides/match-to-training.md`, release notes |
| 71 | Docusaurus user docs | Deferred | When a second academy joins |
| 72 to 74 | Research output, source quality, red team | Built | |
| 75 | Final product test | Partly | Role questions answered in the audit; not rerun |
| 76 to 79 | North star, vision, rules, success | Partly | Definition of success has no measures yet except the slice's |

## Part 2: Grow (sponsorship and funding), sections 1 to 28

All **Deferred** until a named person verifies tax, B-BBEE and POPIA wording (your decision 6B). Reduced to four screens: academy profile, fundable project, contribution log, impact report. Sections 5 (prospect database), 11 and 12 (CRM pipeline and follow-up engine) and 21 (do not build a generic fundraising platform) are **Rejected** as a CRM; 15 (data room) is aggregate numbers only. Sections 1, 2 and 20 (research) are **Built** (R5). The rest wait.

## What this changes

Nine sections have never been given a decision: 7, 22, 23, 33, 37, 46, 50 (interviews), 58 and 61. Five (51 to 55) were missed entirely. The plan needs your picks on both lists.
