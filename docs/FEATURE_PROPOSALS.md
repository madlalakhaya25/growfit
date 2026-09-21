# Feature Proposals

*Written 2026-09-21, after a pass over the codebase and `CLAUDE.md`'s
description of how Growfit Sports Academy actually runs: U11, U13 and U15,
training Wednesday and Friday, matches Sunday, three staff wearing nine hats
between them, three roles still unfilled.*

These are upgrades, not fixes. Correctness work lives in
`IMPROVEMENT_PLAN.md`; the roadmap's own "Next" section still stands. What
follows is ordered by how much of the academy's *manual* work each one
removes, because that is the platform's stated purpose — "digitises and
scales what the academy does manually today."

A deliberate constraint runs through all of it: the academy is three people.
Anything that needs someone to maintain it daily will not get maintained.

---

## 1. Attendance in one tap, from the touchline

**The problem.** Attendance is the spine of the platform — it drives the 75%
welfare threshold, the AI brief, and now the squad filter. It is marked by a
coach on a phone, outdoors, on mobile data, often in the dark in winter. The
current form lists every player with radio buttons.

**Two concrete gaps already known:** the training form offers only
Present/Absent while the policy and the match form use P/A/L/E, so "late"
and "excused" currently register as absences against the threshold
(`ROADMAP.md` names this). And nothing prefills.

**The upgrade.** Open the session, everyone starts Present, tap only the
exceptions. That is the interaction every paper register in the world uses,
and it turns a 20-tap job into a 2-tap one. Add the missing Late/Excused
states, and a "same as last session" shortcut for the common case where the
same two players are away two weeks running.

**Why first.** It happens twice a week, every week, for three squads. Nothing
else in this list recurs that often.

---

## 2. A season calendar, and a subscribable one

**The problem.** Fixtures and training sessions exist as separate lists.
A parent with a U11 and a U15 child has no single view of "what is my week",
and the academy has no view of "what does September look like".

**The upgrade.** A month grid for coaches and admins across all teams, and a
per-family agenda view for parents. Then the part that actually saves work:
publish each team's schedule as an `.ics` feed. A parent subscribes once and
every fixture, time change and cancellation lands in the calendar app they
already use — no notification to build, no app to remember to open, and it
keeps working when the phone has no data.

**Cost.** The data is already there. An `.ics` feed is a route handler and a
text format; the hard part is nothing more than getting the timezone right,
and the `toDateTimeLocal` work already done for fixture editing is the same
lesson.

---

## 3. Registration status as a funnel, not a per-player hunt

**The problem.** Six documents per player per season, three age groups. The
document hub answers "has *this* player signed?" — nobody can answer "who is
still outstanding, tonight" without opening players one at a time. The
roadmap names this; it is worth more than its current placement.

**The upgrade.** One board: rows are players, columns are the six documents,
cells are signed / uploaded / outstanding, filterable by age group. Plus a
"chase" action that produces the message to send the outstanding parents,
ready to paste into WhatsApp.

**The reason it matters more than it sounds.** SAFA/LFA registration is
mandatory to compete. An unregistered player cannot play, and finding that
out on a Sunday morning is the expensive version of this problem.

---

## 4. The AI layer finishes the job instead of describing it

**The problem.** Thirteen AI capabilities all return prose. The suggested XI
cannot populate the tactics board. The generated session cannot become a
training session. The match plan is not saved to the fixture it was written
for, so reading it again regenerates and re-bills it.

**The upgrade.** Ask for structured output alongside the prose, and give each
feature one **Apply** button. This is already item 14 in `IMPROVEMENT_PLAN.md`
and needs product decisions first — what an applied XI does to an existing
selection, whether a generated session lands as a draft. It is listed here
because it is the single largest jump in usefulness available, not because it
is the easiest.

---

## 5. Term reports parents can keep

**The problem.** The AI writes a parent report card on demand. It is never
stored, never sent, and never assembled per term.

**The upgrade.** Once a term, generate one PDF per player — attendance,
milestones completed across the five corners, match ratings, a coach's note,
the attribute passport — and give the parent a link. This is the artefact
that makes an academy look like an institution rather than a WhatsApp group,
and it is the thing a parent forwards to a grandparent.

**Cost.** Every input exists. The PDF pipeline exists (`player-card-pdf.ts`,
`pdf-headshots.ts`). This is mostly assembly.

---

## 6. Injury and availability tracking

**The problem.** The platform records medical information and emergency
contacts, and the Injury & Medical Emergency Policy is one of the eight
adopted policies — but there is nowhere to record that a player is *currently
injured*. So a coach picking a squad, and the AI suggesting an XI, both treat
an injured child as available. The AI's system prompt explicitly says never
to suggest playing an injured child; it has no way to know.

**The upgrade.** A per-player availability state — available / injured /
unavailable, with a date and an optional note — surfaced on the squad card
and the squad-selection screen, and fed into the AI brief. Return-to-play is
a safeguarding matter as much as a football one.

---

## 7. Age-group-aware duplicate and eligibility checks

**The problem.** Age group is a free text field on the team. A player's date
of birth is on the player. Nothing checks that a U13 squad contains U13s, and
nothing catches the same child registered twice from two PDF imports.

**The upgrade.** A standing eligibility check: flag any player whose age falls
outside their team's band, and any two players sharing an ID number, a SAFA
number or a name-plus-DOB. Fielding an overage player is a forfeit and a
reportable matter under the registration agreement the academy already makes
parents sign.

---

## 8. Give the AI a cheaper mouth

**The problem.** Every AI feature calls the same model at the same cost, and
the academy pays per call on one key. A "what does this tactical concept
mean" explainer costs what a full match plan costs.

**The upgrade.** Two tiers: the small, fast model for explainers, summaries
and the assistant's short answers, the stronger one for match plans, reports
and PDF extraction. `ai-models.ts` already centralises the model id and
already has a second slot (`GEMINI_MODEL_DOC`) — this is a third, plus one
argument at each call site. Cheaper per call means the per-user budget added
this week can be more generous, not less.

---

## 9. Offline reads, not just offline writes

**The problem.** Attendance writes now queue offline. Everything else assumes
a connection. A coach at a ground with no signal cannot see the squad list,
the medical details, or the emergency contacts — which is precisely the
information the Injury & Medical Emergency Policy assumes is at hand.

**The upgrade.** Cache the squad, emergency contacts and the next fixture per
team in the service worker, and mark the view plainly as "last updated
Friday". Stale emergency contact details beat none.

---

## 10. Multi-coach visibility

**The problem.** `team_coaches` allows several coaches per team, and the
platform mostly behaves as if there is one. Ratings and assessments are
per-coach; until this week the player page showed only the viewing coach's
assessment while the parent saw the average.

**The upgrade.** Make co-coaching legible: who assessed what and when, who
logged which check-in, who marked the register. Not an audit log (the roadmap
has that separately) — just attribution on the surfaces where two coaches can
disagree without noticing. Buhle coaches all three divisions; Sphe and Khaya
each have one. They already overlap.

---

## Worth saying no to

- **In-app messaging.** The academy runs on WhatsApp and will continue to.
  Announcements plus a paste-ready chase message is the right amount of
  overlap; a second inbox nobody checks is worse than none.
- **Payments and fees.** Already a stated non-goal, and it drags in
  compliance obligations three volunteers should not take on.
- **Automated attribute scoring from video.** Also a stated non-goal, and the
  attribute model's value is that a coach looked at the child.
- **A parent-facing leaderboard.** Ranking children by Overall would change
  what the rating is for, in a way that is hard to undo once parents have
  seen it.

---

## Suggested order

If the next stretch is one or two items, take **1** and **2** — attendance is
the most repeated manual act in the academy's week, and the calendar feed is
the highest ratio of parent-facing value to code written.

If there is room for a third, **6** (injury/availability) is the one with a
safeguarding argument behind it rather than a convenience one.

**3** and **5** are the two that most change how the academy looks to the
outside — to SAFA, to a sponsor, to a parent deciding between clubs.
