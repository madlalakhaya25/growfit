# Coach copilot: think it through

*Status: **built** (2026-10-06). Brief section 22. Approved by Khaya on 2026-10-06 as part of the copilot and learning hub plan.*

## What it does

After a match, when a coach names the problem they saw (typed or tapped from the 20 approved problems), a "Think it through" button helps them reason about it. The answer has seven short sections, in this order: possible causes, questions to ask yourself, the idea in plain words, session ideas, coaching points, what to watch for next match, follow-up questions. Session ideas point at the academy's own curriculum items for that age group, using their exact wording.

## Rules that stay

- Gemini only, on the main model, with thinking off (a direct-answer task).
- The answer is a draft for that coach alone. It is not saved and is never sent to a player or parent.
- The model is shown the problem, the age group and curriculum titles. Never a child's name. The system prompt says the problem is about the team, not a child.
- It teaches the reasoning and says when it is unsure.
- Costs one unit of the coach's AI budget per press.
- Staff only (`requireStaff`).

## How it is built

- `lib/copilot.ts`: the sections, the brief, and the parser. A missing heading is left out; an answer with none is an error, not an empty card.
- `app/actions/copilot.ts`: `thinkItThrough`.
- `components/ai/think-it-through.tsx`, shown under the problem field in the match result form.

## Not done

- No stored or cached answers. Caching would need a new `ai_artefacts` kind and a migration; not worth it for a draft the coach reads once.
- "Turn it into an objective" is the existing weekly focus field just above the button: the coach taps a problem, thinks it through, and saves it as the focus.
- Free-text problems could contain a child's name if the coach types one. The screen says the problem is about the team; nothing strips names.
