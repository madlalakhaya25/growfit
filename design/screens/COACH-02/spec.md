# COACH-02 · Squad

**Status:** as built (25/10/2026, "light card, red edge" redesign). **Route:** `/dashboard/coach/squad?team=<id>`. **Who:** coaches.

## What's on it, top to bottom
1. `PageHeader`: "Squad", with "<team> · <n> players". Actions: a round **More** button (sheet with Term review, Weekly notes, Plans, Emergency contacts, Import players, and Copy invite link) and **Add player** (red, the one red action).
2. Team switcher in the app header when the coach has more than one team.
3. `SquadFilters`: a full-width "Find a player" search, then one scrolling row of chips: **All**, **Needs a word** (below 75% or flagged by readiness), **Forms due**, **Injured** (injured or unavailable), **Not assessed**, each with a count. The chip that's on is red.
4. Players grouped by position (Goalkeepers, Defence, Midfield, Attack, No position yet), one white card per group. Each row: a kit avatar (photo if the club has one, otherwise a shirt in a colour picked from the name with the first initial), full name and short position ("· CB"), and one status pill from `lib/squad-status.ts`, in this order: injured or unavailable with the note, below 75% ("68% this term · check in"), readiness check-in, forms due (all clay); a run of 4+ sessions in a row (sun); then a plain fact: minutes this season, not assessed yet, training %, age.
5. Two columns of groups from `lg:` up.

## Who sees what
Coaches of the team. Parents and players never see this list.

## Data
Team members from `team_members` and `players`; attendance % and streaks from this term's registers (75% policy; excused neither counts nor breaks a run); forms due from `player_documents` (6 per player per season); availability from `players.availability_status`; minutes from `loadSeasonMinutes()`; readiness from `loadReadiness()`; assessed from `player_attributes`.

## Behaviour
- Search and filter live in the URL (`?q=`, `?filter=attendance|docs|injured|unassessed`). The server filters.
- Tap a player → COACH player profile. Remove from squad is a hover button with a mouse, and on the player's page on touch.

## States
- **Loading:** `loading.tsx` in the shape of the grouped list.
- **Empty:** "No players yet", pointing at Add player and the invite link under More.
- **No results:** "No players match", with a way to clear it, plus the "Showing x of y" caption while filtered.
- **Couldn't load:** "Couldn't load this squad".
- **Offline:** last cached screen.

## Open questions
- [ ] Squad numbers on the shirts once the app stores them (the canvas shows "#4").
- [ ] Should the row show the surname as an initial ("Lwazi N.") as the canvas does? Full names kept for now, since coaches search by surname.
