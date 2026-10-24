---
name: growfit-ui
description: Build or change a Growfit screen in web/ the house way. Use for any change to what a page looks like or how it behaves on screen, a new page or component, or writing a screen spec in design/screens/.
---

# Building Growfit UI

Growfit is used on a touchline and in a car park: a phone, one hand, bad
signal, bright sun. Coaches are volunteers; parents see only their own child.
Every screen is judged at 390 px first.

## 1. Read before you touch anything

1. `design/screens/<CODE>/spec.md` for the screen, if there is one
   (`design/README.md` lists them). If you are building a **new** screen or a
   **redesign** and there is no spec, write one first from the template in
   `design/README.md`, mark it `in review`, and ask the person to agree it
   before building. Small fixes don't need a spec.
2. `web/STYLE_GUIDE.md`: principles, tokens, type, touch targets, the
   component table, the four states, words, and the ship checklist.
3. `web/src/app/globals.css` for the token names. Never write a hex value in a
   component; if a colour you need has no token, say so instead of adding one
   quietly.
4. `web/AGENTS.md` and `web/CLAUDE.md`: this Next.js version differs from what
   you know (`proxy.ts`, not `middleware.ts`).

## 2. Build

- **Use the shared components first** (`web/src/components/ui/`): `Button`,
  `Card`, `GroupedSection`, `ListRow`, `PageHeader`, `Badge`, `StatTile`,
  `QueryTabs`, `FilterChip`, `ResultCount`, `ConfirmDialog` via `useConfirm`,
  `EmptyState`, `Skeleton`, `RetryButton`, `Sheet`. Extend one rather than
  copying it.
- **Phone first.** Lay out for 390 px, then let `lg:` add room, not features.
- **One red action per screen.** Everything else is `outline`, `secondary` or
  `ghost`. More than three header actions on a phone means a **More** sheet.
- **44 px tap targets on touch.** Shared components do it; anything custom
  adds `pointer-coarse:h-11` or `min-h-11`.
- **Hover:** `hover:bg-hover` on things without a fill; filled controls keep
  `hover:bg-muted`. Dividers: `border-hairline`.
- **All four states:** loading (a skeleton the shape of the content, plus
  `loading.tsx`), empty (`EmptyState`: what this is for, and the one next
  step), couldn't load (say so, offer Retry; never show 0 or "all caught up"),
  offline (register marks queue; everything else says "You're offline").
- **Children's data stays quiet.** No surnames, ids or photos on anything that
  leaves the app: share sheets, PDFs, WhatsApp text, videos. POPIA applies.
- **Roles.** Coach, parent, player and admin can share a route and see
  different things. A parent only ever sees their own child.

## 3. Words

Plain, short, kind, sentence case. "Couldn't save. Try again." not "An error
occurred." Use the academy's words: squad, register, result, objective,
"Needs you", U11/U13/U15. A destructive button names the action ("Delete
fixture"), and its dialog says what is lost. Dates on screen read like
"Sun 26 Oct"; forms, PDFs and official documents use DD/MM/YYYY.

## 4. Check it

1. `cd web && npx tsc --noEmit && npm run lint -- --max-warnings=0 && npm test`.
2. Start the app (`npm run dev`, with the dummy env vars from
   `playwright.config.ts` if there are no real ones) and run
   `npm run ui:shots -- <route>`. Open every screenshot yourself: 390 and
   1280 px, light and dark. Look at spacing, contrast, wrapping, and each
   state. Signed-in routes need `UI_SHOTS_STORAGE`; if you have no session,
   say the screen wasn't screenshotted rather than implying it was.
3. Go through the ship checklist at the end of `web/STYLE_GUIDE.md`.
4. If the screen has a spec, update it in the same PR when the change alters
   what it describes.

## 5. The pull request

Fill in `.github/pull_request_template.md`'s UI section: the screen code,
the screenshot table, every place the result differs from the spec and why,
and the checklist. Commit messages carry **no AI attribution** of any kind;
CI rejects them (`scripts/check-ai-attribution.mjs`).
