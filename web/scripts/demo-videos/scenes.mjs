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
      { goto: "/dashboard/coach/tactics/board", caption: "Draw it on the tactics board", hold: 5000 },
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
];
