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
      { goto: "/dashboard/admin/reports", caption: "Reports ready for funders and SAFA", scroll: 400, hold: 5000 },
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
        hold: 3800,
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
        hold: 4200,
      },
      {
        caption: "One tap puts it on your tactics board",
        actions: [
          { click: "role:button:Apply" },
          { waitFor: { text: "Open the tactical board", timeout: 30000 } },
        ],
        hold: 1500,
      },
      {
        caption: "And a match plan to go with it",
        actions: [
          { top: true },
          { click: "role:button:Match plan" },
          { waitFor: { selector: 'p:text-is("Match plan")', timeout: 60000 } },
          { scroll: 420 },
        ],
        hold: 4200,
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
];
