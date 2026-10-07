# Growfit style guide

Written from what the app already does (2026-10-06), not a redesign. The
numbers and names below are the ones in the code; if this file and the code
disagree, the code is right and this file needs fixing.

## Principles

1. **Phone first.** Coaches use it on a touchline, parents in a car park. Design the
   390 px screen first; wider screens add space, not features.
2. **One red.** Growfit red does the talking: one primary action per screen.
3. **Say what happened.** A failed load is never shown as an empty or zero result.
   Say "couldn't load" and offer Retry.
4. **Children's data stays quiet.** No surnames, ids or photos on anything that leaves
   the app (share sheets, PDFs, videos).

## Colour

All colours are tokens in `src/app/globals.css`, with a dark-mode pair. Never write a
hex value in a component; use the token (`bg-card`, `text-muted-foreground`).

| Use | Token | Notes |
|---|---|---|
| Page | `background` | near-white `#f2f2f7`, black in dark mode |
| Raised sheet | `card` | white, `#1c1c1e` in dark mode |
| Main action, links, active state | `primary` | `#a71817` light; fill `#cf3a38` dark |
| Red text in dark mode | `.text-primary` | maps to `--color-primary-text` (`#f06462`) automatically |
| Quiet text | `muted-foreground` | `#636366` light, passes 4.5:1 on every surface |
| Good, warning, bad | `success`, `warning`, `destructive` | always with a word or icon, never colour alone |
| Development categories | `dev-technical` ... `dev-leadership` | colour-blind-safe set, always labelled |
| Hero band | `ink` | inverts with the theme |

**Contrast rule:** body text 4.5:1, large text and icons 3:1, in light and dark.
The accessibility scan (`e2e/accessibility.spec.ts`) enforces this on public screens.

## Type

Body is the system font (San Francisco on iPhone), display headings use Barlow
Condensed (`font-display`), numbers use tabular figures (set in `@layer base`).

| Role | Size |
|---|---|
| Page title | `PageHeader` (do not restyle) |
| Section label | 12 px, uppercase, wide tracking (`GroupedSection`) |
| Body | 15 to 16 px |
| Secondary line | 13 px |
| **Smallest allowed** | **12 px.** 10 and 11 px are too small for a touchline; only the avatar status badge is smaller |

## Space, shape, shadow

- Radii: `rounded-xl` for cards, `rounded-full` for buttons and badges.
- Page gutter 16 px on a phone; cards separated by 12 to 16 px.
- Shadows: `shadow-card` for resting, `shadow-float` for sheets and menus only.

## Touch targets

Every tap target is **44 px tall on a touch screen** (Apple's guidance; WCAG 2.2 asks
24 px at minimum). Shared components do this for you: `Button` (`sm` is 36 px on a
mouse and 44 px on touch through `pointer-coarse:`), the tab bars and the confirm
dialog. A new control that is not one of these must set its own `min-h-11`.

## Components (use these before writing a new one)

| Need | Component | Where |
|---|---|---|
| Button | `Button` (variants primary, brand, secondary, outline, ghost, destructive, link, onInk; sizes sm, md, lg, icon) | `components/ui/button.tsx` |
| Card, grouped list, row | `Card`, `GroupedSection`, `ListRow`, `IconTile` | `components/ui/` |
| Page title | `PageHeader` | `components/ui/page-header.tsx` |
| Status chip | `Badge` | `components/ui/badge.tsx` |
| Number tile | `StatTile`, `RatingRing`, `StatBar` | `components/ui/` |
| Tabs | `QueryTabs` (URL `?tab=`), `SectionTabs` | `components/ui/` |
| Confirm a risky action | `ConfirmDialog` | `components/ui/confirm-dialog.tsx` |
| Nothing here yet | `EmptyState` | `components/ui/empty-state.tsx` |
| Loading | `Skeleton`, `Spinner`; `loading.tsx` per route | `components/ui/` |
| Couldn't load | a `border-destructive/50` Card with `RetryButton` | see the coach Today page |
| Toast | `sonner`'s `toast.error` / `toast.success` | |

## States every screen needs

1. **Loading:** a skeleton the same shape as the content, never a blank page.
2. **Empty:** `EmptyState` says what this screen is for and the one thing to do next.
3. **Couldn't load:** says so plainly, with Retry. Never zero, never "all caught up".
4. **Offline:** attendance marks queue and send later; everything else says
   "You're offline" and keeps the last screen. (Cached pages are cleared on sign-out.)

## Words

Plain, short, kind. "Couldn't save. Try again." not "An error occurred." Use the
academy's words: squad, register, result, objective, "Needs you".

## Gap list (where the app breaks this guide, found 2026-10-06)

| Gap | Count | Plan |
|---|---|---|
| Text at 10 or 11 px (`text-[10px]`, `text-[11px]`) | 2 places (avatar badges, which sit in a 16 px circle) | everything else raised to `text-xs` (12 px) on 2026-10-07 |
| Hex colours written in components | 108 places | most are in the PDF, canvas and print code where tokens do not apply; the rest move to tokens |
| Small controls with their own `h-8`/`h-9` | about 25 places | switch to `Button` or add `pointer-coarse:` height |
| Arbitrary text sizes (`text-[13px]`, `[15px]`, `[17px]`, `[22px]`) | about 25 places | fold into the type table above |
| Signed-in screens not scanned for accessibility | all | needs a seeded test project |
