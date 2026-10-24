# Screen specs

One folder per screen, `design/screens/<CODE>/spec.md`. A spec says what is on
the screen, who sees what, where each number comes from, which states it has,
and what is still undecided. It is the thing to read before changing a screen,
and the thing to write before building a new one.

The look itself lives in `web/STYLE_GUIDE.md` and `web/src/app/globals.css`.
A spec never restates tokens or sizes; it names components and says what goes
in them.

## When a spec is needed

- **New screen or redesign:** write the spec first, mark it `in review`, and
  build once it is `ready`.
- **Small fix or copy change:** no spec needed. If the screen has one and the
  change alters what it describes, update it in the same PR.

## Status

The first line under the title says one of:

| Status | Meaning | Build it? |
|---|---|---|
| `idea` | Thinking out loud | No |
| `in review` | Waiting for Buhle, Sphe or Khaya to agree | No |
| `ready` | Agreed; build to this | Yes |
| `as built` | Written from the live screen, to change from | It's already built |
| `superseded` | Replaced; kept for history | No |

## Codes

`<AREA>-<NN> · <Screen>`, for example **COACH-01 · Today**. Use the code in
threads, issues and PR titles so everyone means the same screen.

| Prefix | Area |
|---|---|
| `AUTH` | Sign in, join, register a club |
| `COACH` | Coach screens |
| `PAR` | Parent screens |
| `PLY` | Player screens |
| `ADM` | Admin (academy director) screens |
| `PRINT` | Printed or PDF output: term reports, match sheets |
| `SITE` | The public marketing site in `site/` |

## Spec template

```markdown
# <CODE> · <Screen>

**Status:** <idea | in review | ready | as built>. **Route:** `<route>`. **Who:** <roles>.

## What's on it, top to bottom
1. ...

## Who sees what
<Differences between coach, parent, player and admin. "Only coaches" is fine.>

## Data
<Where each number comes from (table or function). Say which are sample data in a mock-up.>

## Behaviour
- <Action> → <result>.

## States
- **Loading:** ...
- **Empty:** ...
- **Couldn't load:** ...
- **Offline:** ...

## Open questions
- [ ] ...
```

## Specs so far

| Code | Screen | Status |
|---|---|---|
| [COACH-01](screens/COACH-01/spec.md) | Today | as built |
| [COACH-02](screens/COACH-02/spec.md) | Squad | as built |
| [COACH-03](screens/COACH-03/spec.md) | Training session | as built |
| [COACH-04](screens/COACH-04/spec.md) | Fixture | as built |
| [COACH-05](screens/COACH-05/spec.md) | Playing time | as built |
