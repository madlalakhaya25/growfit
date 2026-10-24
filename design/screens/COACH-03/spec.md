# COACH-03 · Training session

**Status:** as built (24/10/2026). **Route:** `/dashboard/coach/training/<id>?tab=plan|register|notes`. **Who:** coaches.

Training is Wednesday and Friday. This is where a coach plans the session, takes the register, and writes the debrief.

## What's on it, top to bottom
1. Back link, session header (date, time, team, focus) with Edit and **Delete session**.
2. `QueryTabs`: **Plan**, **Register**, **Notes**. Only the open tab's data loads.
3. **Plan:** session runner (one drill at a time with a stopwatch, for pitch-side), curriculum picker, session generator, numbered drill list, add a drill or add from the library.
4. **Register:** one row per player with P / A / L / E (present, absent, late, excused), RSVPs shown beside, "marked by" line, and a one-tap effort rating for the squad.
5. **Notes:** session debrief, photos and videos.

## Who sees what
Coaches only. Players see their own session page at `/dashboard/player/training/<id>` (PLY spec to come).

## Data
`training_sessions`, `training_drills`, `training_attendance` (with `marked_by`, `marked_at`), `training_rsvps`, `media_uploads`.

## Behaviour
- Register marks save in a batch as they're tapped ("Saving…", "Saved"), and save straight away when the coach leaves the page or locks the phone.
- Late and excused are not shown in red: the 75% policy is about welfare, and neither is what it's looking for.
- Delete session → confirm dialog naming what's lost.

## States
- **Loading:** `loading.tsx` shaped like the register.
- **Empty:** no drills → generator and add-drill prompts; no players → message on the register.
- **Couldn't load:** per-tab error card with Retry.
- **Offline:** register marks queue on the phone and send when back online, with a toast saying so.

## Open questions
- [ ] Register is the most-used tab on training days. Should it be the default tab on the day of the session?
