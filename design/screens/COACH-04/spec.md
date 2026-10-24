# COACH-04 · Fixture

**Status:** as built (24/10/2026). **Route:** `/dashboard/coach/fixtures/<id>?tab=overview|squad|report`. **Who:** coaches.

Matches are on Sunday in the GDFL. This screen runs a match from team sheet to report.

## What's on it, top to bottom
1. Matchday header on the inverted `ink` band: opponent, home or away, kickoff, venue, status badge with a coloured dot. Actions: Edit, **Cancel fixture**, **Delete fixture**.
2. Cancelled notice when the match is off.
3. `QueryTabs`: **Overview**, **Squad**, **Report**.
4. **Overview:** log result (opens by itself once kickoff has passed and no result is in), phases of play, squad appearances.
5. **Squad:** match attendance and squad selection; link to Playing time (COACH-05).
6. **Report:** match stories for each family (draft, edit, share, take back), match report, photos and videos.

## Who sees what
Coaches. Parents see the fixture in their own list and, once shared, their child's story only.

## Data
`fixtures`, `match_results`, `match_attendance`, `family_messages` for stories, `media_uploads`.

## Behaviour
- Cancel fixture tells families it's off; Delete fixture removes it with no notice (the dialog says so).
- A story with flagged wording asks "Share it anyway?" before sharing.
- Stories never include surnames (children's data stays quiet).

## States
- **Loading:** `loading.tsx`.
- **Empty:** no result yet → log form; no squad → prompt to pick one.
- **Couldn't load:** error card with Retry.
- **Offline:** last cached screen; match attendance queues like the training register.

## Open questions
- [ ] Ratings out of 5 and the post-match report live under Report; is that where coaches look for them after the match?
