# Learning hub for coaches

*Status: **screen and structure built** (2026-10-06); lessons not written yet. Brief section 23. Approved by Khaya on 2026-10-06.*

## What it is

A **Learn** tab (under Develop) with short lessons, about a two-minute read each, grouped by area: technical, tactical, physical, psychological, safeguarding, goalkeeping, girls' football, leadership, academy management, Laws of the Game, player development.

## Rules that stay

- Lessons live in code (`lib/lessons-content.ts`), so a pull request is the review trail. No database change.
- A lesson shows only when `approved: true`, which is set only after Buhle has read and approved that exact wording. A draft is invisible, and its address shows "not found".
- Every screen says it is Growfit guidance, not endorsed by SAFA, CAF or FIFA, and awards no licence. A lesson that follows a published framework names it in `source`.
- Nothing here is sent to a child or parent.

## First batch (not yet written)

One lesson per approved match problem (20), then safeguarding basics. Claude drafts, Buhle edits and approves, then the lessons are added with `approved: true`. Until then the screen says no lessons yet.

## Not done

- A "read more" link from a match problem to its lesson (add when the first lessons exist).
- Parent tips (dropped by Khaya on 2026-10-06).
