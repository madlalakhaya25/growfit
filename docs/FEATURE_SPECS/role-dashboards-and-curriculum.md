# Plan: role dashboards and curriculum

*Status: **plan approved by Khaya 2026-10-06**; build follows the Match to Training slice (now complete). Written 2026-10-06. Builds on the master brief, `docs/PRODUCT_STRATEGY.md` and the Match → Training → Follow-up slice.*

## Why these two belong together

A role dashboard answers "what do I need to know and do today?" for one person. Most of the "no" answers in the brief's role questions fail for one reason: the academy's intent (what we teach, at which age, and why) is not stored as data. The curriculum is that missing intent. Dashboards for the technical director and academy director are mostly views over it. So the curriculum comes first, and the new dashboards read from it.

## Part 1: Curriculum (the academy's own competency list)

**What it is.** A list of what the academy teaches, per age group, in the academy's own words, grouped under the five milestone categories already in the app (Technical, Tactical, Physical, Mental, Leadership). Example item: "Receive on the back foot under light pressure" (U13, Technical). Buhle fills it in for Growfit FA. It is configurable per academy, which is the "academy-in-a-box" core; Growfit FA's list is the first template.

**What it replaces.** Today there are three separate lists that do not talk to each other: 5 milestone categories, 6 drill categories and 30 attributes. The curriculum does not delete them. It sits above them and links to them, so nothing existing breaks.

**Data (one additive migration, next free number after 067).**
- `curriculum_items`: academy, age group, category, title (1 to 200), description, sort order, active, created by. Admin writes, coaches read. Parents and players: no access at first.
- `curriculum_links`: item to `session` | `drill` | `objective` | `milestone`. This is how coverage is counted.

**Screens.**
1. Admin: Academy > Curriculum. Add, reorder, retire items per age group. Starts empty with a clear "Buhle: start here" prompt. No AI-written content goes in without Buhle approving it.
2. Coach: when planning a session or logging a match problem, an optional "Which curriculum items is this about?" picker, filtered to the team's age group. Optional, so coaches are never blocked.
3. Coverage (admin and technical director): per age group and term, which items have been trained, how many times, and when last. "Not touched this term" is the useful list. Computed from links, never typed in.
4. Development objective gets a curriculum item, so "we worked on X" becomes countable.

**Not in this part.** Player-level IDP objectives, parent-facing curriculum, scoring players against items, AI generation of a curriculum (could be a draft helper later, reviewed by Buhle).

**Open question for Buhle.** The starting list. I would draft a short starter set per age band from the SAFA and FIFA research in `docs/research/R2-R3`, and Buhle edits it. Until he approves, the screen ships empty.

## Part 2: Role dashboards

**What exists.** Four database roles (admin, coach, parent, player) and a Today home for each (admin #116, parent #117, player #118, coach home). They show tasks and counts.

**The gap.** The brief asks for academy director, technical director, scout and owner views. Growfit FA has three people who each wear several hats (Buhle: director, technical director, finance, U13 coach; Sphe: U11 coach, admin and equipment; Khaya: U15 coach, fundraising, registration).

**Recommended approach: titles, not new roles.** Keep the four database roles. Add an optional staff "hat" on a profile (for example `director`, `technical_director`, `safeguarding`, `finance`, `fundraising`) that only chooses which cards appear on the admin or coach home. A hat gives no extra data access, so no new row security to get wrong. Someone with two hats sees both sets of cards.

**What each hat sees (all computed from data we already have, plus coverage once Part 1 lands).**
- Academy director: registration health, teams to chase, welfare check-ins due, fixtures this week, open objectives per team and which have no follow-up.
- Technical director: curriculum coverage by age group, objectives with no training linked yet, sessions per team this term, objectives with verdicts (what worked).
- Safeguarding officer (open seat): welfare flags, coach checks due. Needs CPR Part B and first-aid dates stored first (not built).
- Fundraising and finance: parked with Grow.
- Scout: **not built.** Needs the audit log and a safeguarding review first (external viewer of child data). Stays on the roadmap.
- Owner: same cards as director; no separate role.

**Order inside Part 2.** Hats and the card picker first (small), then director cards, then technical director cards after coverage exists.

## Proposed build order (one PR each, ask before any production migration)

Finish the slice's remaining PRs first, since they create the objective data these views need, then:

1. Curriculum table and rules, with tests. Migration 068 run. **Done (#131).**
2. Admin curriculum screen. **Done (#133).** Buhle's starter list (60 items) is loaded.
3. Curriculum picker on sessions and on a team's open objectives. **Done (#134 to #136).**
4. Coverage view in Academy settings. **Done (#137, #138).**
5. Staff hats and the card picker.
6. Director and technical director cards.

## Decisions I need from you

1. **Role model:** staff hats on the four existing roles (recommended), or new database roles.
2. **Order:** finish slice PRs 3 to 5 first (recommended, about three more PRs), or build curriculum now and fold the slice's later steps in after.
3. **Curriculum starter:** I draft a short starter list for Buhle to edit (recommended), or leave it empty for Buhle to write.
