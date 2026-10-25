---
name: growfit-ux-review
description: Review a Growfit screen, flow or UI pull request for usability, accessibility, copy and children's-data safety, with screenshots. Use when asked to review, critique or audit a screen or PR, or to find what to improve next.
---

# Reviewing Growfit UX

Review as the people who use it: **Buhle** (director, coaches everything, does
the finance and compliance on a laptop), **Sphe** (U11 coach and admin, on a
phone at Wednesday and Friday training), **Khaya** (U15 coach, fundraising and
registration), a **parent** checking one child between other things, and a
**player** aged 10 to 15.

## 1. See it

- Read the screen's spec in `design/screens/` if there is one.
- Take screenshots: `cd web && npm run ui:shots -- <route>` against a running
  app (`UI_SHOTS_STORAGE` for signed-in routes). Open all four: 390 and
  1280 px, light and dark. Review from the screenshots and the code together,
  never from the code alone. If you could not screenshot it, say so.

## 2. Check, in this order

1. **The job.** What did this person come here to do? Can they do it in one
   or two taps on a phone, with one hand? Is the most likely action the one
   red button?
2. **States.** Loading, empty, couldn't load, offline. A failed load must
   never look like zero or "nothing to do".
3. **Touch and reach.** 44 px targets on touch; nothing important only on
   hover; nothing that needs two hands mid-session.
4. **Contrast and type.** 4.5:1 for text, 3:1 for icons and borders, in both
   themes; nothing under 12 px; status never shown by colour alone.
5. **Children's data.** No surnames, ids or photos on anything shareable.
   Parents see only their own child. Medical and welfare details only where
   a coach needs them.
6. **Words.** Sentence case, plain, the academy's own words, destructive
   buttons naming the action, consequences stated.
7. **Consistency.** Shared components and tokens, not one-offs. Same thing,
   same name, same place as on other screens.
8. **Policy fit.** Where it applies: the 75% attendance threshold and welfare
   check-in, the 6 registration documents, the 4-stage discipline policy,
   safeguarding (Children's Act 38 of 2005).

## 3. Report

Lead with the two or three changes that would matter most to the people
above, then the rest, each as: **where** (screen code or route, and file),
**what's wrong**, **who it hurts and when**, **the fix**. Mark each
*must fix* (breaks a rule in `web/STYLE_GUIDE.md`, accessibility or
children's data), *should fix*, or *idea*. Include the screenshots you used.
Don't pad with praise or restate what works.

Reviewing a PR you didn't write: report to the person; don't push to the
branch unless they ask.
