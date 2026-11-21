// One entry per demo clip. Edit freely; nothing else needs to change.
//
// role:    which seeded login to use (see supabase/seed.sql), or "public" for no login.
// device:  "desktop" (1280x720, 16:9) or "phone" (430x932, vertical, for Reels/TikTok/Status).
// steps:   run in order. Each step may have:
//            goto     route to open
//            caption  line shown over the bottom of the screen for this step
//            scroll   total px to scroll down, smoothly, across the hold time
//            click    visible text (or CSS selector) of something to move the cursor to and click
//            hold     ms to stay on the step (default 3500)
//            actions  things a viewer sees happen, in order (see doAction in ../demo-videos.mjs):
//                       click   "role:button:Name" (regex on the accessible name), visible text, or CSS
//                       key / press   a keyboard key (the tactics board has R run, P pass, K shot shortcuts)
//                       drag    { on: "<css>", from: [fx, fy], to: [fx, fy] }, fractions of that element
//                       expand  summary text of a collapsed section (no-op when open)
//                       check   label text of a tick box (ticks it; safe to re-run)
//                       type    { selector, text }      center / top / scroll   move the page
//                       waitFor { text | selector, timeout }   wait for something real to appear
//                       caption change the caption mid-step; after  ms to pause (default 700)
// scene.viewport and scene.captionAt ("top" | "bottom") override the device defaults.
//
// Captions are the marketing message: say the benefit to a coach or parent, not the UI.

export const ROLES = {
  coach: "coach@seed.growfit.test",
  assistant: "assistant@seed.growfit.test",
  admin: "admin@seed.growfit.test",
  parent: "parent@seed.growfit.test",
  player: "player@seed.growfit.test",
  public: null,
};

export const SCENES = [
  {
    id: "00-smoke-login",
    title: "Pipeline check",
    role: "public",
    device: "desktop",
    steps: [{ goto: "/auth/login", caption: "Pipeline check: public page", hold: 2500 }],
    skipByDefault: true,
  },
  {
    id: "01-squad-at-a-glance",
    title: "Your whole squad, one screen",
    role: "coach",
    device: "desktop",
    steps: [
      { goto: "/dashboard/coach", caption: "Every coach starts the week here", hold: 3500 },
      { goto: "/dashboard/coach/squad", caption: "Your whole squad, one screen", scroll: 500, hold: 5000 },
    ],
  },
  {
    id: "02-attendance-and-training",
    title: "Training plans and attendance",
    role: "coach",
    device: "desktop",
    steps: [
      { goto: "/dashboard/coach/training", caption: "Plan the week's sessions", hold: 4000 },
      { goto: "/dashboard/coach/training/week", caption: "See the whole week at once", hold: 4000 },
      { goto: "/dashboard/coach/welfare", caption: "Players below 75% attendance are flagged for a welfare check-in", scroll: 400, hold: 5000 },
    ],
  },
  {
    id: "03-match-day",
    title: "Match day, sorted",
    role: "coach",
    device: "desktop",
    steps: [
      { goto: "/dashboard/coach/fixtures", caption: "Fixtures, squads and results in one place", scroll: 400, hold: 5000 },
      { goto: "/dashboard/coach/tactics", caption: "Plan the shape before kick-off", hold: 4000 },
    ],
  },
  {
    id: "04-talk-to-parents",
    title: "Keep every parent informed",
    role: "coach",
    device: "desktop",
    steps: [
      { goto: "/dashboard/coach/announcements", caption: "Announce to a squad. Parents see only what is about their child", scroll: 300, hold: 5500 },
    ],
  },
  {
    id: "05-parent-view",
    title: "What parents see",
    role: "parent",
    device: "phone",
    steps: [
      { goto: "/dashboard/parent", caption: "Parents get their child's week on their phone", scroll: 500, hold: 5000 },
      { goto: "/dashboard/parent/fixtures", caption: "Next match, kick-off time and any changes", hold: 4500 },
      { goto: "/dashboard/parent/announcements", caption: "No more WhatsApp scrolling", hold: 4000 },
    ],
  },
  {
    id: "06-player-development",
    title: "Player development",
    role: "player",
    device: "phone",
    steps: [
      { goto: "/dashboard/player/development", caption: "Players see their own growth, season by season", scroll: 600, hold: 6000 },
    ],
  },
  {
    id: "07-academy-health",
    title: "Run the academy with confidence",
    role: "admin",
    device: "desktop",
    steps: [
      { goto: "/dashboard/admin/analytics", caption: "Attendance, registration and results at a glance", scroll: 500, hold: 5500 },
      { goto: "/dashboard/admin/reports", caption: "Export records as CSV or a print-ready PDF", scroll: 400, hold: 5000 },
    ],
  },

  {
    id: "08-tactical-board",
    title: "The tactical board",
    role: "coach",
    device: "desktop",
    viewport: { width: 1600, height: 900 },
    captionAt: "top",
    steps: [
      {
        goto: "/dashboard/coach/tactics/board",
        caption: "Pick a formation and your real squad lines up",
        actions: [{ click: "role:button:Set up my XI" }],
        hold: 1200,
      },
      {
        caption: "Add the opposition",
        actions: [{ click: "role:button:^Players" }, { click: "role:button:Set up opponent XI" }],
        hold: 900,
      },
      {
        caption: "Draw runs, passes and shots",
        actions: [
          { center: "svg.touch-none" },
          { key: "r" },
          { drag: { on: "svg.touch-none", from: [0.2, 0.52], to: [0.15, 0.25] } },
          { key: "p" },
          { drag: { on: "svg.touch-none", from: [0.5, 0.77], to: [0.5, 0.52] } },
          { key: "p" },
          { drag: { on: "svg.touch-none", from: [0.3, 0.72], to: [0.2, 0.54] } },
          { key: "k" },
          { drag: { on: "svg.touch-none", from: [0.5, 0.52], to: [0.5, 0.12] } },
        ],
        hold: 1500,
      },
      {
        caption: "See who controls the space",
        actions: [
          { top: true },
          { click: "role:button:Coach AI" },
          { click: "role:button:Space control" },
          { center: "svg.touch-none" },
        ],
        hold: 2600,
      },
      {
        caption: "Check the passing lanes",
        actions: [{ top: true }, { click: "role:button:Passing lanes" }, { center: "svg.touch-none" }],
        hold: 2200,
      },
      {
        caption: "Walk the squad through it in 3D",
        actions: [{ click: "role:button:^3D$" }],
        hold: 2600,
      },
    ],
  },

  {
    id: "09-ai-assistant",
    title: "The AI assistant coach",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    // Records against scripts/demo-videos/mock-gemini.mjs (scripted model wording; the rest is the
    // real app). See that file before describing this clip as live AI output.
    needsAi: true,
    steps: [
      {
        goto: "/dashboard/coach/assistant",
        caption: "Ask it about your own squad",
        actions: [
          { type: { selector: 'input[placeholder^="Ask about your squad"]', text: "Who needs a welfare check-in?" } },
          { press: "Enter" },
          { waitFor: { selector: ".leading-relaxed", timeout: 60000 } },
          { scroll: 250 },
        ],
        hold: 2000,
      },
      {
        caption: "Pick the match and the shape, then get a starting XI",
        actions: [
          { top: true },
          { select: { selector: 'select[aria-label="Fixture"]', index: 1 } },
          { select: { selector: 'select[aria-label="Formation"]', label: "3-3-2 · 9-a-side · U11–U12" } },
          { click: "role:button:Suggest XI" },
          { waitFor: { selector: 'p:text-is("Suggested XI")', timeout: 60000 } },
          { scroll: 380 },
        ],
        hold: 2200,
      },
      {
        caption: "One tap puts it on your tactics board",
        actions: [
          { click: "role:button:Apply" },
          { waitFor: { text: "Open the tactical board", timeout: 30000 } },
        ],
        hold: 900,
      },
      {
        caption: "Scout the opponent from your own data",
        actions: [
          { top: true },
          { click: "role:button:Scout opponent" },
          { waitFor: { selector: 'p:text-is("Scouting report")', timeout: 60000 } },
          { scroll: 300 },
        ],
        hold: 2200,
      },
      {
        caption: "And a match plan to go with it",
        actions: [
          { top: true },
          { click: "role:button:Match plan" },
          { waitFor: { selector: 'p:text-is("Match plan")', timeout: 60000 } },
          { scroll: 420 },
        ],
        hold: 2200,
      },
    ],
  },

  {
    id: "10-our-curriculum",
    title: "Your coaching philosophy, built in",
    role: "admin",
    device: "desktop",
    steps: [
      {
        goto: "/dashboard/admin/academy?tab=curriculum",
        caption: "Write what your academy teaches, age group by age group",
        scroll: 1100,
        hold: 6500,
      },
      {
        goto: "/dashboard/admin/academy?tab=coverage",
        caption: "See what you have really trained this term",
        actions: [{ center: ':text-is("U13")' }],
        hold: 4500,
      },
      {
        caption: "And what you have not yet touched",
        actions: [{ scroll: 260 }],
        hold: 4000,
      },
    ],
  },
  {
    id: "11-plan-by-philosophy",
    title: "Plan every session against it",
    role: "coach",
    device: "desktop",
    steps: [
      {
        goto: "/dashboard/coach/training/10000000-0000-0000-0000-000000000509",
        caption: "Every session starts with one clear objective",
        actions: [
          { expand: "What is this about" },
          { check: "Defensive organisation" },
          { check: "Reacting when we lose the ball" },
          { click: "role:button:^Save$", optional: true },
        ],
        hold: 3200,
      },
      {
        goto: "/dashboard/coach/learn",
        caption: "Short lessons for the problems you see on the pitch",
        scroll: 500,
        hold: 5000,
      },
    ],
  },

  // ───────────── Segments for the themed videos (see videos.mjs) ─────────────
  {
    id: "v1-week",
    title: "Plan the week",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      { goto: "/dashboard/coach/training", caption: "Plan the week around your next match", hold: 3200 },
      { goto: "/dashboard/coach/training/week", caption: "See every session and how hard it is on the squad", hold: 3800 },
    ],
  },
  {
    id: "v1-session",
    title: "Plan a session",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      {
        goto: "/dashboard/coach/training/10000000-0000-0000-0000-000000000509",
        caption: "Pick the objective from your own curriculum",
        actions: [
          { expand: "What is this about" },
          { check: "Defensive organisation" },
          { check: "Reacting when we lose the ball" },
          { click: "role:button:^Save$", optional: true },
        ],
        hold: 900,
      },
      {
        caption: "Let AI build the whole session",
        actions: [
          { center: "text=AI session planner" },
          { type: { selector: 'input[placeholder^="e.g. U15"]', text: "U13" } },
          { type: { selector: 'input[placeholder^="e.g. Pressing"]', text: "Winning the ball back" } },
          { click: "role:button:Generate session plan" },
          { waitFor: { text: "Rondo 4v2", timeout: 60000 } },
          { scroll: 1500 },
        ],
        hold: 600,
      },
      {
        caption: "Five drills, each with a diagram, ready to run",
        // Not clicking "Apply to this session": the demo sessions use hand-made ids that the action's
        // strict UUID check rejects. Real sessions have real UUIDs. See seed_demo.sql.
        actions: [{ center: 'button:has-text("Apply to this session")' }],
        hold: 2200,
      },
    ],
  },
  {
    id: "v1-register",
    title: "Take the register",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      {
        goto: "/dashboard/coach/training/10000000-0000-0000-0000-000000000509?tab=register",
        caption: "Take the register in seconds",
        actions: [
          { click: '[aria-label="Attendance for Lindiwe Mahlangu"] button:text-is("Late")' },
          { click: '[aria-label="Attendance for Sanele Buthelezi"] button:text-is("Absent")' },
          { click: '[aria-label="Attendance for Thulani Nkosi"] button:text-is("Absent")' },
          { click: "role:button:Mark remaining", optional: true },
        ],
        hold: 2200,
      },
    ],
  },
  {
    id: "v1-welfare",
    title: "Welfare flags",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      { goto: "/dashboard/coach/welfare", caption: "Players under 75% attendance are flagged for a welfare check-in", hold: 4200 },
    ],
  },

  {
    id: "v2-fixtures",
    title: "Match day prep",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      { goto: "/dashboard/coach/fixtures", caption: "Every fixture, result and cancellation in one list", hold: 3000 },
      {
        goto: "/dashboard/coach/fixtures/10000000-0000-0000-0000-0000000000f2",
        caption: "Pick the squad and share the team sheet",
        actions: [{ click: "Team sheet" }],
        hold: 2600,
      },
      { caption: "Plan fair playing time for every child", actions: [{ click: "Playing time" }], hold: 2600 },
    ],
  },

  {
    id: "v3-insights",
    title: "Player insights",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      {
        goto: "/dashboard/coach/squad/10000000-0000-0000-0000-0000000000c1",
        caption: "Get an evidence-based read on any player",
        actions: [
          { click: "role:tab:Development" },
          { click: "role:tab:Plan" },
          { center: 'button:has-text("Generate insights"), button:has-text("Refresh")' },
          { click: "role:button:Generate insights|Refresh" },
          { waitFor: { text: "STRENGTHS", timeout: 60000 } },
          { scroll: 300 },
        ],
        hold: 2400,
      },
    ],
  },

  {
    id: "v4-learn",
    title: "Lessons for coaches",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      { goto: "/dashboard/coach/learn", caption: "Short lessons for the problems you see on the pitch", scroll: 250, hold: 3000 },
      { caption: "Plain language, built for volunteer coaches", actions: [{ click: "Pressing together" }, { scroll: 450 }], hold: 2600 },
    ],
  },

  {
    id: "v5-announce",
    title: "Tell the squad",
    role: "coach",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      {
        goto: "/dashboard/coach/announcements",
        caption: "Write the message once",
        actions: [
          { type: { selector: 'input[placeholder^="e.g. Training cancelled"]', text: "Match day: Chatsworth United" } },
          { type: { selector: 'textarea[placeholder^="Write your announcement"]', text: "Match day Thursday 26 Nov. Kick-off 18:59 at Chatsworth Stadium. Meet at Riverside Grounds at 17:30 with both kits." } },
        ],
        hold: 500,
      },
      {
        caption: "One tap rewrites it so a 13-year-old can follow it",
        actions: [
          { click: "role:button:Simplify for U13" },
          { waitFor: { text: "Simpler version", timeout: 60000 } },
          { click: "role:button:Use this version" },
        ],
        hold: 1200,
      },
      // Not clicking Post: the demo team id fails the same strict UUID check, so the post would show an
      // error. The parent clip that follows shows the announcements parents receive.
      { caption: "Then post it. Parents see it on their phone", actions: [{ center: 'button:has-text("Post announcement")' }], hold: 2000 },
    ],
  },
  {
    id: "v5-parent",
    title: "What parents see",
    role: "parent",
    device: "phone",
    sideNote: { kicker: "FOR PARENTS", text: "Their child's week, on their phone. No WhatsApp scrolling." },
    steps: [
      { goto: "/dashboard/parent/announcements", caption: "The message arrives instantly", hold: 3200 },
      { goto: "/dashboard/parent", caption: "Next match, kick-off and what needs signing", scroll: 350, hold: 3600 },
      { goto: "/dashboard/parent/fixtures", caption: "Fixtures and any change, with the reason", hold: 3200 },
    ],
  },
  {
    id: "v5-player",
    title: "What players see",
    role: "player",
    device: "phone",
    sideNote: { kicker: "FOR PLAYERS", text: "Challenges, progress and their own football passport." },
    steps: [
      { goto: "/dashboard/player/challenges", caption: "Skill challenges set by their coach", hold: 3200 },
      { goto: "/dashboard/player/development", caption: "Their own growth, season by season", scroll: 450, hold: 3600 },
    ],
  },
  {
    id: "v4-player-dev",
    title: "Development on the phone",
    role: "player",
    device: "phone",
    sideNote: { kicker: "THE PHILOSOPHY, IN THE PLAYER'S HANDS", text: "Players see the same five headings their coaches teach." },
    steps: [
      { goto: "/dashboard/player/development", caption: "Progress against what the academy teaches", scroll: 600, hold: 5200 },
    ],
  },

  {
    id: "v6-overview",
    title: "Club overview",
    role: "admin",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      { goto: "/dashboard/admin", caption: "The whole club at a glance", hold: 3600 },
      { goto: "/dashboard/admin/analytics", caption: "Attendance, ratings and registration, live", scroll: 450, hold: 4600 },
    ],
  },
  {
    id: "v6-health",
    title: "Academy health report",
    role: "admin",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      {
        goto: "/dashboard/admin/analytics",
        caption: "A monthly health report, written from your own numbers",
        actions: [
          { center: 'button:has-text("Generate report"), button:has-text("Refresh")' },
          // "Refresh" when an earlier take's report is already saved: it regenerates, so the clip still
          // shows the working state.
          { click: "role:button:Generate report|Refresh" },
          // When nothing has changed the app offers the saved report first; regenerate for the clip.
          { click: "role:button:Regenerate anyway", optional: true },
          { waitFor: { text: "ACADEMY OVERVIEW", timeout: 60000 } },
          { scroll: 380 },
        ],
        hold: 4200,
      },
    ],
  },
  {
    id: "v6-paperwork",
    title: "Paperwork and reports",
    role: "admin",
    device: "desktop",
    viewport: { width: 1440, height: 810 },
    steps: [
      { goto: "/dashboard/admin/players/documents", caption: "Registration paperwork for every player, tracked", hold: 4200 },
      { goto: "/dashboard/admin/reports", caption: "Export records as CSV or a print-ready PDF", hold: 3600 },
    ],
  },
];
