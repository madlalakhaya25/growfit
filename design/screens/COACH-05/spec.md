# COACH-05 · Playing time

**Status:** as built (24/10/2026). **Route:** `/dashboard/coach/fixtures/<id>/minutes`. **Who:** coaches.

Fair minutes for everyone, planned before kickoff and run live on the touchline.

## What's on it, top to bottom
1. Back to the fixture, `PageHeader` "Playing time", "vs <opponent> · fair minutes for everyone".
2. **Plan:** pick who's playing (defaults to who was marked present and available), match format from the age group (U11, U13, U15), keeper flagged.
3. **Live:** the clock, who's on, the next change with who comes off and who goes on (pre-filled with the fair suggestion; tap names to swap). Confirm is only enabled when the numbers match.
4. **Finish:** minutes per player, save, or **Discard minutes**.

## Who sees what
Coaches only.

## Data
Players and availability from the squad; attendance from the match register; the plan from `minutes-planner`. A match in progress lives in `localStorage` per fixture.

## Behaviour
- A reload or a locked phone picks the match up where it left off.
- **Start over** and **Discard minutes** both ask first.

## States
- **Empty:** "There are no players in this squad yet."
- **Offline:** works fully offline during the match; saving at the end needs a connection.

## Open questions
- [ ] Saving at the end needs signal, and pitches often have none. Queue the save like register marks?
