// The finished videos: each is a title card, some recorded scenes cross-faded together (scenes.mjs),
// and the Growfit end card. Aim for 45-60 seconds each, one idea per video.
//
//   id        output file name (web/demo-videos/out/<id>.mp4)
//   kicker    small line above the title on the title card
//   parts     scene ids from scenes.mjs, in order
export const VIDEOS = [
  {
    id: "01-plan-and-train",
    kicker: "PLAN \u00b7 TRAIN \u00b7 TRACK",
    title: "Plan the week. Run the session. Look after every player.",
    subtitle: "Pick each session's objective from your own curriculum, get an AI-built session with diagrams, take the register in seconds, and catch welfare flags early.",
    parts: ["v1-week", "v1-session", "v1-register", "v1-welfare"],
  },
  {
    id: "02-match-day",
    kicker: "MATCH DAY",
    title: "From team sheet to tactics board.",
    subtitle: "Pick the squad, share fair playing time, then walk the team through the plan in 3D.",
    parts: ["v2-fixtures", "08-tactical-board"],
  },
  {
    id: "03-ai-coaching",
    kicker: "AI COACHING INSIGHTS",
    title: "An assistant coach that knows your squad.",
    subtitle: "Answers about your own players, a starting XI, a scouting report and a match plan, all from your own data.",
    parts: ["09-ai-assistant", "v3-insights"],
  },
  {
    id: "04-your-philosophy",
    kicker: "YOUR PHILOSOPHY, BUILT IN",
    title: "Develop the person, develop the player, develop the team.",
    subtitle: "Write what the academy teaches by age group, track what is really trained, and put it in every player's hands.",
    parts: ["10-our-curriculum", "v4-learn", "v4-player-dev"],
  },
  {
    id: "05-parents-and-players",
    kicker: "PARENTS \u00b7 PLAYERS",
    title: "Everyone in the loop, in one tap.",
    subtitle: "The coach writes it once. Parents and players get exactly what is about their child.",
    parts: ["v5-announce", "v5-parent", "v5-player"],
  },
  {
    id: "06-run-the-academy",
    kicker: "RUN THE ACADEMY",
    title: "Compliance, reporting and a monthly health check.",
    subtitle: "Registration paperwork for every player, live analytics, an AI health report and CSV or PDF exports.",
    parts: ["v6-overview", "v6-health", "v6-paperwork"],
  },
  {
    id: "07-player-profile-and-passport",
    kicker: "PLAYER PROFILE \u00b7 PASSPORT",
    title: "Every player's story, in one profile.",
    subtitle: "Ratings, development, video clips and a shareable passport that parents, schools and scouts can open.",
    parts: ["v7-profile", "v7-passport", "v7-parent-child"],
  },
  {
    id: "08-film-room",
    kicker: "MATCH FILM",
    title: "Break down a play like a TV analyst.",
    subtitle: "Freeze a frame from a phone clip, draw over it, and save it for the squad. The clip itself never leaves your device.",
    parts: ["v8-film"],
  },
  {
    id: "09-development-plans",
    kicker: "DEVELOPMENT PLANS",
    title: "A plan for every player. The coach stays in charge.",
    subtitle: "AI drafts each plan from the child's own ratings, attendance and milestones. Nothing reaches a player or parent until you approve it.",
    parts: ["v9-plans", "v9-notes", "v9-parent"],
  },
  {
    id: "10-safe-and-compliant",
    kicker: "SAFE \u00b7 COMPLIANT",
    title: "Look after every child, and the paperwork that protects them.",
    subtitle: "Emergency contacts that work with no signal, forms signed on a phone, and a child's record erased when the law asks.",
    parts: ["v10-emergency", "v10-forms", "v10-erasure"],
  },
];

// Opening video, cut from the best moments of the finished videos above (no new recording).
// Each cut is { src: <video id>, from, to } in seconds. Build the videos first.
export const HIGHLIGHTS = [
  {
    id: "00-growfit-in-60-seconds",
    kicker: "GROWFIT FA",
    title: "Run your academy like a pro.",
    subtitle: "Plan, coach, communicate and stay compliant in one app, built for grassroots football in South Africa.",
    cuts: [
      { src: "02-match-day", from: 59, to: 65 },
      { src: "01-plan-and-train", from: 38, to: 44 },
      { src: "03-ai-coaching", from: 22, to: 28 },
      { src: "01-plan-and-train", from: 52, to: 57 },
      { src: "04-your-philosophy", from: 5, to: 10 },
      { src: "02-match-day", from: 30, to: 36 },
      { src: "05-parents-and-players", from: 30, to: 35 },
      { src: "06-run-the-academy", from: 23, to: 29 },
    ],
  },
];
