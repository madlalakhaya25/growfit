# Product Roadmap

FootballPath is built incrementally. This document tracks what has shipped, what is being built, and what is planned. Priorities are reviewed each sprint.

---

## Shipped ✅

### Phase 1 — Foundation & Auth
- Email + password authentication (login, register, forgot password, reset password)
- Role selection at signup: Coach, Player, Parent
- `handle_new_user()` trigger auto-creates profile on signup
- Role-based dashboard routing (`/dashboard/:role`)
- Pilot single-academy setup with `DEFAULT_ACADEMY_ID`

### Phase 1 — Core Coach Workflows
- Create and manage teams (multiple teams per coach)
- Squad management: add players (new or by invite code), view by position, remove
- Player detail: photo, position, attributes, rating history
- Create and manage fixtures (upcoming / past split)
- Log match results: score, player appearances, per-player ratings (1–5)
- Cancel and manage fixture status

### Phase 1 — Player Passport
- Player passport card with overall rating ring
- Six-attribute assessment (Pace, Shooting, Passing, Dribbling, Defending, Physical) rated 1–99 per coach
- Attribute bars + rating history
- Share token for public URL: `/passport/:token` — no login required
- Claim unclaimed profile by share token

### Phase 1 — Parent Engagement
- Link child by share token at registration or from dashboard
- View child's passport (attributes, ratings, position)
- Relationship label (Parent / Guardian / Grandparent / Sibling / Other)

### Phase 1 — Announcements
- Coach posts announcements per team
- Players see their team's feed
- Feed design: left accent bar, relative timestamps, "New" badge for < 24h posts

### Phase 2 — Training Module
- Training sessions with type (General / Technical / Tactical / Fitness / Match Prep / Recovery)
- Date, time, location, session notes
- Ordered drill list per session with title, description, optional video URL
- Coach: full CRUD on sessions and drills
- Player: read-only session and drill view
- Color-coded session type chips throughout

### Phase 3 — Profile Polish
- Coach profile: full name, coaching role (datalist suggestions), phone, bio
- Player profile: full name, phone, bio
- Parent profile: full name, phone
- Settings page per role at `/dashboard/:role/settings`
- `coaching_role`, `bio`, `phone` columns on profiles
- Settings link in sidebar

### UX Foundation
- Responsive layout: desktop sidebar + mobile bottom nav
- Dark mode (class-based, persisted via `next-themes`)
- PWA manifest + service worker + install prompt
- `formatRelativeTime()` utility for human-readable timestamps
- Coach dashboard "What's Next" smart cards: nearest fixture + training session with day countdown
- Color-coded training type chips
- Dashed empty states with icon and contextual CTA
- `DROP POLICY IF EXISTS` guards on all migrations (idempotent re-runs)

---

### Phase 4 — Tactics

- Tactical board: 16 formation presets (5/7/9/11-a-side), automatic player
  assignment by position, opponent set-up in the opposing half
- Drawing tools: runs, passes, dribbles, freehand; undo/redo; names toggle
- Pitch overlays: thirds, channels and half-spaces, zone 14 and cut-back zones
- Frame-by-frame animation with playback, PNG export, and video recording
- Saved plays: concept tags, session/fixture links, filtering, templates
- Shared plays with a player-facing animated view and coach voice notes
- Tactical concept library, positional roles, and a player position guide

### Phase 5 — Squad-aware AI

- Shared squad-context layer feeding real ratings, form, attendance and results
  into the AI features
- Conversational coach assistant with multi-turn follow-ups
- Suggested XI with per-player reasoning, and full pre-match plans
- Play describer and opponent counter-analysis from the board
- Read-aloud for AI output at the touchline

## In Progress 🔄

### Admin Dashboard
- Academy-wide player search and filtering
- Team management (create, assign coaches)
- Basic reporting: squad sizes, fixture counts

---

## Near term (next 1–3 sprints)

### Player photo upload
- Upload via Supabase Storage from coach squad view
- Photo displayed on player card, passport, and public page

### Fixture notifications (in-app)
- "New fixture scheduled" notification for players when a coach adds one
- Supabase Realtime + client-side listener

### Announcement delete for coach
- Confirm before delete, immediate feed update

### Public passport improvements
- Academy branding (logo, colours) on the public page
- QR code generation from share token

### Training attendance
- Players can mark themselves "attending" or "unavailable" for a session
- Coach sees attendance counts per session

---

## Medium term (1–2 months)

### Push notifications (mobile)
- Expo push notifications for new fixtures, announcements, and training sessions
- Notification preferences per player

### Player progress charts
- Rating trend over time (line chart)
- Attribute history per coach

### Match report
- Coach writes a structured post-match report (key moments, top performers)
- Visible to players and parents from fixture detail

### Invite link / QR code for squad joining
- Generate a shareable link from team settings
- Player clicks link → lands on join page → auto-links to team

### Multi-academy support
- Remove `DEFAULT_ACADEMY_ID` singleton
- Academy creation at registration for admins
- Academy switcher for coaches who work across academies

---

## Long term (3–6 months)

### Talent marketplace (opt-in)
- Players opt in to be "discoverable"
- Scouts/clubs browse by position, age group, location
- Contact via in-app message (no direct contact details shared)

### Parent engagement feed
- Aggregated activity feed for parents: new rating, new training session, match result, announcement
- Weekly digest email (Supabase Edge Functions + Resend)

### Video highlights
- Coach attaches a match or training highlight video to a player's profile
- Hosted via Supabase Storage or external YouTube/Vimeo link

### Tournament / league management
- Create a league table with multiple teams
- Auto-calculate standings from logged fixtures

### Analytics dashboard (admin)
- Squad growth over time
- Fixture win/draw/loss record
- Training frequency heatmap

### Offline mode (mobile)
- Cache recent fixture and training data for poor-connectivity environments
- Sync when connection restores

---

## Architectural backlog

| Item | Priority | Notes |
|------|----------|-------|
| Multi-tenancy | High | Academy_id scaffolding is already in place; mainly routing + UI changes |
| Database indexes under load | Medium | RLS helper functions hit `profiles` on every query; index `(id, role, academy_id)` |
| Supabase Realtime for announcements | Medium | Feed without page refresh |
| Rate limiting on server actions | Medium | Prevent announcement spam; can use Upstash Redis |
| E2E test suite | Medium | Playwright against a test Supabase project |
| i18n (isiZulu, Sesotho, Afrikaans) | Low | `next-intl`; translation keys partially structured already |
| Audit log | Low | Who did what, when — important for academies with multiple coaches |

---

## Non-goals

These are explicitly out of scope to keep the platform focused and maintainable:

- **Live match tracking** — real-time score updates require infrastructure complexity that isn't justified for this use case
- **Financial transactions / payments** — stripe integration, subscription billing
- **Social network features** — likes, comments, follower graphs
- **Gamification** — points, leaderboards, streaks (unless clearly validated with users)
- **Video hosting** — we link to external video; we don't transcode or host video ourselves
- **Custom AI/ML** — automated attribute scoring from video; out of scope for the current team size
