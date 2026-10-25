# COACH-01 · Today

**Status:** as built (24/10/2026). **Route:** `/dashboard/coach`. **Who:** coaches (and the admin when coaching).

The screen a coach opens most: what's next, and what needs doing.

## What's on it, top to bottom
1. `PageHeader`: today's date as the eyebrow, "Good morning, <first name>", a **New team** outline button (only once the coach has a team).
2. **Next up:** the next fixture as a `FixtureTicket`, then the next training session as a row. Quick buttons for a new fixture and a new session.
3. **Needs you** (`GroupedSection`): results to log (kickoff has passed), registers not taken in the past 7 days, players below the 75% attendance threshold.
4. Open objectives for this week.
5. Hat cards: the extra jobs this coach holds (admin, equipment, fundraising, registration).
6. **Your teams** (`GroupedSection`): one row per team.
7. **Add another team** card (join with a code, or create).

## Who sees what
Coaches only. A coach with several teams sees team names on objectives; with one team they're hidden.

## Data
`teams` via the coach's memberships; next fixture and session from `fixtures` and `training_sessions`; Needs you from `today-cards.tsx` (`NeedsYou`); objectives from `OpenObjectives`; hats from `HatCards`.

## Behaviour
- Tap a Needs you row → the fixture's log form, the session's register, or the welfare page.
- The next match and session render first; slower cards stream in behind their own skeletons.

## States
- **Loading:** `loading.tsx`, plus `CardSkeleton` per streamed card.
- **Empty (no team):** Join a team and Create your own team cards.
- **Couldn't load:** separate cards for "Couldn't load your teams", "Couldn't load what's next" and "Couldn't check what needs you", each with Retry.
- **Offline:** offline banner; last cached screen.

## Open questions
- [ ] Should **Needs you** sit above **Next up**? On a Sunday morning the next match matters most; midweek the to-do list does.
- [ ] Hat cards and the add-team card push **Your teams** below the fold on a phone. Move add-team behind the **New team** button only?
