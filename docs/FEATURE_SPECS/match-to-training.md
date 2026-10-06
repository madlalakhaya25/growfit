# Match → Training → Follow-up

*Status: **steps 1 to 5 built**; migration 067 still to run in production. Written 2026-10-06 from
[`PRODUCT_STRATEGY.md`](../PRODUCT_STRATEGY.md) and the research in
[`docs/research/`](../research/).*

## Purpose

Turn one problem a coach saw on Sunday into Wednesday's and Friday's training, and
check at the next match whether it got better. It is the first vertical slice
of the master brief: the smallest end-to-end loop that goes from user action to
data, evidence, insight and the next action.

It also creates the first two of the five building blocks in the strategy:
**Objective** (a target with an owner, a timeframe and a verdict) and
**Evidence** (who saw what, when, how sure). Later features (player IDP
objectives, coverage, development debt, the season review, sponsor impact
reports) reuse them.

## Problem

| | |
|---|---|
| **Who** | The head coach of each age group (Buhle U13, Sphe U11, Khaya U15) |
| **Today** | The coach logs the result, rates each phase of play 1–5 (`match_results.phase_ratings`, migration 061) and writes notes. Training is then planned from memory or the session generator with a free-text focus. Nothing records that Wednesday's session was *about* Sunday's problem, and nothing asks at the next match whether it worked. |
| **Cost** | Problems repeat for weeks unnoticed. When a coach leaves, the reasons behind training choices leave with them. The coach-facing question "what should I work on next?" is only partly answered (strategy page, "What the brief is really asking"). |

## Method (research basis)

Football Australia's *Football Coaching Process* (2019) uses a "football problem"
loop: identify the moment of the game, define it with what, who, where, when and why, write a
session objective, design a session that ends in a game re-creating the
problem, then evaluate "objective achieved? problem solved?" as
yes / partially / no. It is official, simple and already field-tested, so this
spec follows it closely. Sources and caveats are in
[`research/R2-R3-football-development.md`](../research/R2-R3-football-development.md).

Age-band rule from the same research: for U11 and U13 a problem maps to an
individual skill (first touch, striking the ball, 1v1, running with the ball). For U15
it can map to a team principle. Plain language throughout. No "tactical
periodisation" label (no empirical studies support it).

## User flow

1. **Name the problem (after the match, one screen, under a minute).**
   On the match log page, after phase ratings, a new step "What do we work on
   this week?" pre-selects the lowest-rated phase. The coach picks one problem
   from a short list for that phase and age band, or types their own. Optional:
   where on the pitch, when in the match, and up to 5 players most involved
   (coach-only; see Permissions). Saving creates an **open objective** for the
   team. At most 2 open objectives per team.
2. **Plan for it (during the week).** The objective shows on the coach's home
   and on the week plan as "This week: keep the ball when playing out from the
   back". "Plan a session for it" opens the existing session generator with the
   focus prefilled and the rule "end with a game that re-creates the problem".
   Saving the session links it to the objective. A coach can also link an
   existing session or a tactics-board play.
3. **Check it (at the next match).** When the coach logs the next match for that
   team, the log asks, before phase ratings: "Last week you worked on X. Did we
   see the problem again?" No / A bit / Yes, which is stored as the verdict
   improved / partly / not yet. The phase rating comparison (before and after)
   is shown beside it automatically. The coach can close the objective, keep it
   for another week, or replace it.
4. **Remember it.** Closed objectives form the team's history on Squad Review:
   what was worked on, how many sessions, and the verdict. That history is the
   first piece of "academy memory".
5. **Tell families (optional, reviewed).** The weekly family note can include one
   team-level line, such as "This week the U13s worked on keeping the ball when
   playing out from the back". No child is named. It goes through the existing note
   approval.

## Optional AI step: "Why might this be happening?"

Behind a flag and **off until the Gemini terms question is settled** (see
Risks). Gemini stays on the free tier until official roll-out (Khaya,
2026-10-06), so this step sends no personal data at all. One structured call returns 2–4 possible causes, a question to
check each, and coaching points. It is labelled "AI suggestions" and the
coach ticks what applies, so the AI never writes the objective. Input is the
problem text, age band and phase only: **no player names or IDs**. The flow
above works fully without it.

## Data model (one migration, additive)

The next free number at build time (067 is free on `main` and on every remote
branch as of 2026-10-06).

```
development_objectives
  id uuid pk
  academy_id uuid not null            -- tenant isolation, as elsewhere
  subject_type text  check in ('team')  -- 'player' added later for IDP objectives
  subject_id uuid not null            -- team id for this slice
  source_type text   check in ('match','coach')   -- provenance
  source_fixture_id uuid null references fixtures
  phase text null                     -- a MatchPhaseId from lib/match-phases.ts
  problem text not null (1..200)      -- coach's words, or a preset label
  problem_key text null               -- preset id, when one was picked
  detail jsonb null                   -- where / when / why, all optional
  objective text not null (1..200)    -- "Improve our ability to …"
  status text check in ('open','closed') default 'open'
  verdict text null check in ('improved','partly','not_yet')
  follow_up_fixture_id uuid null references fixtures
  closed_at timestamptz null
  created_by uuid not null, created_at timestamptz default now()

development_objective_links            -- what was done about it
  objective_id uuid references development_objectives on delete cascade
  link_type text check in ('session','play','player')
  link_id uuid not null
  primary key (objective_id, link_type, link_id)
```

Phase ratings stay where they are. The before and after comparison reads
`match_results.phase_ratings` for `source_fixture_id` and `follow_up_fixture_id`,
so no number is copied.

**Why one generic table, not a match-problems table:** the same row shape later
holds player IDP objectives (today stored inside AI artefact JSON with free-text
areas, so they cannot be counted) and coach development goals. Development debt
then becomes a query: open objectives with no linked session for 7 days, or no
verdict after the next match.

## Permissions (RLS)

- Select, insert and update: coaches of the team (`is_team_coach(subject_id)`)
  and admins of the academy. Same pattern as fixtures and training.
- **Parents and players: no access to the rows.** Families see only the approved
  team-level line in the weekly note. Player links (`link_type='player'`) are
  coach-only. Naming a child as "involved in the problem" is a judgement of
  that child and stays inside the coaching staff.
- No delete for coaches. An objective is closed, not removed, so history
  survives a coach leaving. Admin delete only, for mistakes.

## Pure modules and where the code goes

| Module | Job |
|---|---|
| `lib/match-problems.ts` | Preset problems per phase and age band (draft list, **Buhle to approve the wording**, like presets). `suggestPhase(ratings)` returns the lowest-rated phase. |
| `lib/objectives.ts` | Status rules (max 2 open, close, carry over), verdict mapping from No / A bit / Yes, `objectiveDebt(objectives, sessions, fixtures, today)` |
| `lib/objectives-data.ts` | Loaders through the user's session; missing table degrades to empty (as in the Today loaders) |
| `app/actions/objectives.ts` | Create, link, check, close. Async-only exports and fresh `{error}` literals, per the Server Action rules |

UI reuses what exists: the match log page, the session generator, the week plan,
coach home, Squad Review, and the family note builder. No new top-level navigation.

## States

Empty (no match logged yet: nothing shows), first objective, two open, the follow-up
asked, the follow-up skipped (stays open, asked again next match), the match
cancelled (not counted as a follow-up), and a team with two coaches (both see and
can check it). Offline: the step is skipped with "Add it later" when the save
fails. It is not queued in this slice.

## Acceptance criteria

1. From a logged match, a coach creates an objective in **two taps** using the
   suggested phase and a preset, or by typing their own words.
2. The open objective appears on the coach home and the week plan for that team.
3. "Plan a session for it" opens the session generator with the focus
   prefilled. The saved session is linked and counted.
4. Logging the team's next match asks the follow-up question once, shows the
   before and after phase ratings, and stores the verdict.
5. Squad Review lists closed objectives with session counts and verdicts.
6. A parent or player account cannot read any objective row (RLS test).
7. A coach of another team cannot read or write the objective (RLS test).
8. The family note line appears only after the note is approved, and names no child.
9. Everything works with the AI step off.

## Testing

- Unit tests for every pure function, mutation-checked as the project does.
- Permission tests for the RLS policies (coach of team, other coach, parent,
  player, admin).
- Component tests for the new log step and the follow-up question.
- Server-action tests: an objective cannot be created for a team the user does
  not coach; a third open objective is refused.
- The e2e smoke test still passes.

## Build steps (one PR each, merged when CI, Sonar and GitGuardian are green)

1. Migration and pure modules with tests. **Migration approved with you first,
   by decision card, before it runs in production.**
2. "What do we work on this week?" step on the match log. *Built (PR 2): free text plus a phase picker that defaults to the lowest-rated phase; presets wait for Buhle's wording. Hidden when the team already has two open.*
3. The objective on the coach home and the week plan, the session generator prefill, and linking. *Built (PR 3): a "This week" list on the coach home and the week plan; "Plan a session" opens the new-session page with the focus prefilled and the objective carried, and the saved session is linked. Linking a tactics-board play comes with the play editor later.*
4. The follow-up question at the next match, the verdict, and history on Squad Review. *Built (PR 4): the match log asks "Did we see the problem again?" (No / A bit / Yes) for each open objective set at an earlier match; the answer closes it with the verdict and this match, and "Keep working on it" prefills a new focus. Squad Review lists closed objectives with sessions planned and the before and after phase rating.*
5. The family note line, plus a user guide page and release notes. *Built (PR 5): the weekly note gains one team line naming the phase of play in fixed family wording (never a child, never the coach's words), only for a focus with a session planned. Guide: `docs/guides/match-to-training.md`.*
6. (Later, separate) The AI "Why might this be happening?" helper, once AI terms are settled.

## Measures (after 4–6 weeks of use)

- Share of logged matches that produce an objective (target: most).
- Share of objectives with at least one linked session before the next match.
- Share of objectives that get a verdict.
- Coach time on the new step, by asking the coaches.
- Whether the same problem recurs less over the following matches (judgement,
  not statistics, with three teams).

## Risks and open items

- **Gemini terms (blocks the AI step only).** The free tier uses prompts for
  training, and Google's Gemini API and Vertex AI terms both bar use in a service
  "likely to be accessed by individuals under the age of 18". This affects every
  existing AI feature, not just this one. See
  [`research/R7-R8-ai-language-offline.md`](../research/R7-R8-ai-language-offline.md)
  and [`research/R1-R5-privacy-and-funding.md`](../research/R1-R5-privacy-and-funding.md).
- **Coach habit (assumption A1).** If the step takes more than two taps, it
  will be skipped. It is always skippable.
- **Preset wording.** Buhle approves the problem list. Until then the step
  offers free text only.
- **Player tags.** These are kept coach-only and optional. Dropping them is
  possible if they feel like labelling a child.
