# Learning hub for coaches

*Status: **built** (2026-10-06); the first 20 lessons are in, approved by Khaya's reply "Approved" to the draft. Brief section 23. Approved by Khaya on 2026-10-06.*

## What it is

A **Learn** tab (under Develop) with short lessons, about a two-minute read each, grouped by area: technical, tactical, physical, psychological, safeguarding, goalkeeping, girls' football, leadership, academy management, Laws of the Game, player development.

## Rules that stay

- Lessons live in code (`lib/lessons-content.ts`), so a pull request is the review trail. No database change.
- A lesson shows only when `approved: true`, which is set only after Buhle has read and approved that exact wording. A draft is invisible, and its address shows "not found".
- Every screen says it is Growfit guidance, not endorsed by SAFA, CAF or FIFA, and awards no licence. A lesson that follows a published framework names it in `source`.
- Nothing here is sent to a child or parent.

## First batch (in)

One lesson per approved match problem (20), each with four parts: what you see, why it happens, what to try, what to watch for next match. Under a tapped problem on the match result form, a "Read the lesson" link opens it. Safeguarding basics (two adults, changing rooms, photos, transport) are the second batch and are not written yet.

Buhle has not been recorded as reading these; if he edits the wording, change it in `lib/lessons-content.ts` in a pull request.

## Not done

- Parent tips (dropped by Khaya on 2026-10-06).
