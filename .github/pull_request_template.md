## What changed

<!-- One or two sentences on what this does and why. -->

## How it was checked

<!-- What you actually ran, and what you looked at. "Tested" on its own isn't enough. -->

## UI changes

<!-- Delete this section if nothing on screen changed. -->

**Screen:** <!-- e.g. COACH-01 · Today, from design/screens/ -->

| | Light | Dark |
|---|---|---|
| 390 px | | |
| 1280 px | | |

<!-- `npm run ui:shots -- <route>` writes these to web/test-results/ui/. Drag them into the table. -->

**Differs from the spec, and why:**

**Checklist** (from `web/STYLE_GUIDE.md`)

- [ ] Built at 390 px first, then checked at 1280 px
- [ ] Light and dark checked for contrast
- [ ] Loading, empty, couldn't load and offline states
- [ ] 44 px tap targets, visible focus
- [ ] One primary action on the screen
- [ ] No surnames, ids or photos on anything that leaves the app
- [ ] Destructive buttons name the action
- [ ] Role differences (coach, parent, player, admin) noted
