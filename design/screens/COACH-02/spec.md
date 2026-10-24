# COACH-02 · Squad

**Status:** as built (24/10/2026). **Route:** `/dashboard/coach/squad?team=<id>`. **Who:** coaches.

## What's on it, top to bottom
1. `PageHeader`: "Squad", with "<team> · <age group> · <n> players". Actions: copy invite link, **Term review**, **Weekly notes**, **Plans**, **Emergency contacts**, **Import**, and add player.
2. Team switcher when the coach has more than one team.
3. `SquadFilters`: search by name, then filters **All**, **Below 75%**, **Docs outstanding**, **Not assessed**, each with a count.
4. Players grouped by position under small uppercase headings. Each row: avatar, name, and badges for injured or unavailable, age, preferred foot, minutes this season, attendance when below 75%, documents due, not assessed.

## Who sees what
Coaches of the team. Parents and players never see this list.

## Data
Team members from `team_members` and `players`; attendance % from the register (75% policy); documents due from `player_documents` (6 per player per season); minutes from `loadSeasonMinutes()`; assessed from `player_attributes`.

## Behaviour
- Search and filter live in the URL (`?q=`, `?filter=`), so a filtered squad can be shared or reloaded. The server filters.
- Tap a player → COACH player profile (`/dashboard/coach/squad/<playerId>`).

## States
- **Loading:** `loading.tsx`.
- **Empty:** "No players yet. Add your first player to get started."
- **No results:** "No players match", with a way to clear the search.
- **Couldn't load:** "Couldn't load this squad" with Retry.
- **Offline:** last cached screen.

## Open questions
- [ ] Six outline buttons in the header wrap to three rows on a 390 px phone. Keep add player and invite visible; move Term review, Weekly notes, Plans, Emergency contacts and Import into a **More** sheet?
- [ ] Applied filters should read as chips with a count caption ("Showing 6 of 45 players"). Item 6 of the Vela adoption plan.
