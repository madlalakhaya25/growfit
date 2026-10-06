# Experience quality: UI and performance

*Status: **plan approved 2026-10-06; step 1 (measure) in progress**. Written 2026-10-06. Covers the
master brief's UX/UI, design system, accessibility and performance-budget
sections (51 to 55), which had not been scheduled.*

## Why

Coaches use Growfit on a phone, at a pitch, on mobile data. The redesign work
so far changed how the app looks; nothing has measured how fast it loads or how
usable it is for everyone. This plan measures first, sets budgets from the
numbers, then fixes the worst things in small PRs.

## Baseline so far (code-level, from one production build, 2026-10-06)

| Signal | Reading |
|---|---|
| JavaScript shipped across all routes | 3.7 MB raw, about 1.1 MB gzipped |
| Biggest chunks | 571 KB (pdf-lib), 378 KB (recharts), 370 KB (Sentry), 306 KB (zod), 236 KB (Supabase client), 210 KB (motion library) |
| Lazy loading (`next/dynamic`) | none used anywhere |
| Client components | 168 files marked `"use client"` |
| Images | 11 plain `<img>` tags, 3 files use `next/image` |
| Accessibility attributes | 757 `aria-` uses, so the work has started; not yet audited |

### Per route (step 1, `npm run build` then `npm run measure:bundle`)

JavaScript the browser loads for one page, gzipped. 77 routes; median 120 KB, heaviest 351 KB.

| Route | Gzipped | What stands out |
|---|---|---|
| /dashboard/coach/tactics/board | 351 KB | The heaviest page; expected for a canvas editor, but it ships video and PDF export code up front |
| /dashboard/coach/squad/[playerId] | 267 KB | Player profile, charts |
| /dashboard/player, /dashboard/admin/analytics | 237 KB | Both carry the charts library |
| /auth/login, /register, /forgot-password, /reset-password | 173 to 175 KB | **The first page every user sees is heavier than most dashboards** |
| Everything else in the top 25 | 122 to 141 KB | Shared base of about 120 KB on every page |

Reading it: the app has a shared base of about 120 KB on every page (framework,
Supabase client, form validation, Sentry), and a handful of pages add charts,
PDF or video code on top. The login page is the cheapest win: it loads
about 50 KB more than the base it needs.

Not measured yet, and needed before any budget is set: real load times on a
mid-range phone over a throttled connection, a Lighthouse and axe scan of the
ten busiest screens, and a design-system gap list (spacing, type, colour and
tap-target consistency).

## Steps (one PR each)

1. **Measure.** Script that records per-route JS size, plus a Lighthouse (mobile,
   throttled) and axe scan of the ten busiest screens. Output: a table in this
   file. No app changes.
2. **Budgets.** Agree numbers from step 1 (for example: coach home under a stated
   JS size and load time on a throttled phone; zero serious axe issues). Add a CI
   check that fails when a budget is broken.
3. **Cheap performance wins.** Load pdf-lib, recharts and the other large,
   rarely-used libraries only on the screens that need them; switch the 11
   `<img>` tags to `next/image`; check Sentry's size and sample rate.
4. **Accessibility fixes.** Whatever axe finds, worst first: labels, contrast,
   focus order, tap targets of at least 44 px, keyboard use of the tactics board
   alternatives.
5. **Design system.** Write `STYLE_GUIDE.md` from what the app already does,
   list the places that break it, and fix the shared components first.
6. **Phone feel.** Loading and empty states, offline messages, and the screens
   coaches use on the touchline (match log, attendance, week plan).

## Out of scope

A redesign. A new component library. Native apps.

## Measures

Budgets from step 2 met on every PR; axe serious and critical issues at zero;
coaches' own view of whether the match log and attendance feel fast.
