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
    subtitle: "Session plans built from your own curriculum, a register that takes seconds, and welfare flags before anyone slips through.",
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
    subtitle: "Registration paperwork, live analytics and an AI health report, ready for funders and SAFA.",
    parts: ["v6-overview", "v6-health", "v6-paperwork"],
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
