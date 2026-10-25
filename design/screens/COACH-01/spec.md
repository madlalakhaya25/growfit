# COACH-01 · Today

**Status:** as built (25/10/2026, "light card, red edge" redesign chosen by Khaya on the design canvas). **Route:** `/dashboard/coach`. **Who:** coaches (and the admin when coaching).

The screen a coach opens most: what's next, what needs doing, and who to say well done to.

## What's on it, top to bottom
1. `PageHeader`: today's date as the eyebrow, with "· Match day" when one of the coach's teams plays today; "Morning, <first name>".
2. **Next up card** (`next-up.tsx`): the soonest match or session this week, as a white card with a 6 px red top edge. Eyebrow: team (when the coach has several), Home/Away or Training, and "1 of 3 today" on a busy Sunday. A pill counts down ("In 1 h 40 min", "Tomorrow", "Kicked off"). Title in the display face: "vs <opponent>" or the session title. Kickoff time and venue. Buttons: **Pick the squad** (red) and **Playing time** for a match; **Take the register** or **Open the session** for training.
3. **Coming up / Later today:** everything else this week (each team's next match, the next session) as rows with the time in the display face.
4. **Needs you · n:** rows with a clay icon tile and kind wording: "We've missed <first name> lately" (one player below 75%) or "We've missed n players lately", results still to log, registers not taken in the past 7 days. "All caught up" when there's nothing.
5. **This week:** up to four sun cards: birthdays in the next 7 days ("Ayanda turns 11 on Friday · say it at training") and each team's longest current run of sessions in a row (4 or more). First names only. Hidden when there's nothing to say.
6. Open objectives for this week.
7. Hat cards: the extra jobs this coach holds.
8. **Your teams:** one row per team, invite codes under it.
9. **Add another team** card (join with a code, or create).

## Who sees what
Coaches only. Team labels appear on the next-up card, rows and moments only when the coach has more than one team.

## Data
`teams` via the coach's memberships; next fixtures (earliest per team in the next 7 days) and next session from `fixtures` and `training_sessions`; Needs you from `NeedsYou`; moments from `ThisWeekMoments` (`team_members` with `players.date_of_birth`, this term's `training_sessions` and `training_attendance`); wording from `lib/today-moments.ts` and `lib/squad-status.ts`.

## Behaviour
- The header, next-up card and coming-up rows render first; Needs you, This week, objectives and hats stream in behind their own Suspense boundaries.
- Tap the card title or a row → the fixture or session page. **Pick the squad** → the fixture's Squad tab; **Playing time** → `/fixtures/<id>/minutes`.

## States
- **Loading:** `loading.tsx`, plus `CardSkeleton` for Needs you.
- **Empty (no team):** Join a team and Create your own team cards.
- **Nothing scheduled:** a dashed card with Schedule fixture and Plan training.
- **Couldn't load:** "Couldn't load your teams", "Couldn't load what's next", "Couldn't check what needs you", each with Retry. This week hides itself on failure, since nothing in it is a task.
- **Offline:** offline banner; last cached screen.

## Open questions
- [ ] RSVP counts ("12 of 14 coming") on the next-up card, as on the canvas, once match availability is collected.
- [x] Bottom nav now says Today/Matches/Squad/Training/Me, as on the canvas (navigation review, 25/10/2026).
