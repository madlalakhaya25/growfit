// What Leah says, per video. Keyed by the scene id that is on screen (or by cut number for the opening video).
// Written naturally (AI, 3D, CSV, 75%): the recorder spells these out for the voice only, so subtitles stay clean.
// Short sentences. Say only what the screen shows.
// Edit freely; `npm run demo:videos -- --voice` re-synthesises only the lines that changed.
//
// Voice: Microsoft Edge neural voice en-ZA-LeahNeural, slightly slower (see VOICE in ../demo-videos.mjs),
// the same voice as the Botlhale demos.

export const NARRATION = {
  "00-growfit-in-60-seconds": {
    intro: "Growfit, for grassroots football academies.",
    cuts: [
      "Your real squad on the tactics board, in 3D.",
      "AI builds your sessions, with a diagram for every drill.",
      "An assistant coach that knows your squad.",
      "A register that takes seconds.",
      "Your own coaching philosophy, built in.",
      "Draw it. Share it. Walk the team through it.",
      "Parents and players, always in the loop.",
      "And a monthly health check for the whole academy.",
    ],
    outro: "Growfit. Run your academy like a pro.",
  },

  "01-plan-and-train": {
    intro: "Plan the week. Run the session. Look after every player.",
    parts: {
      "v1-week": "Start the week here. Your next match, your planned sessions, and how hard each day is on the squad.",
      "v1-session":
        "Pick each session's objective from your own curriculum. Then let AI build the session: five drills, each with a diagram, ready to run.",
      "v1-register": "After training, take the register in seconds. Mark who was late or absent, and everyone else is present in one tap.",
      "v1-welfare": "Anyone below 75% attendance is flagged for a welfare check-in, before they slip through.",
    },
    outro: "Growfit. Run your academy like a pro.",
  },

  "02-match-day": {
    intro: "From team sheet to tactics board.",
    parts: {
      "v2-fixtures":
        "Every fixture and result in one list. Pick your squad, share the team sheet, and plan fair playing time for every child.",
      "08-tactical-board":
        "On the tactics board, your real squad lines up in any formation. Draw runs, passes and shots. See who controls the space, check the passing lanes, then walk the team through it in 3D.",
    },
    outro: "Growfit. Run your academy like a pro.",
  },

  "03-ai-coaching": {
    intro: "An assistant coach that knows your squad.",
    parts: {
      "09-ai-assistant":
        "Ask about your own players and it answers from your data. Who needs a welfare check-in? Get a suggested starting eleven and save it straight to your tactics board. Scout the opponent from what you have logged, and get a match plan to go with it.",
      "v3-insights":
        "Open any player for an evidence-based read on their strengths, what to work on next, and drills to try.",
    },
    outro: "Growfit. Run your academy like a pro.",
  },

  "04-your-philosophy": {
    intro: "Develop the person. Develop the player. Develop the team.",
    parts: {
      "10-our-curriculum":
        "Write what your academy teaches, age group by age group, under five headings. Then see what has really been trained this term, and what has not yet been touched.",
      "v4-learn": "Short lessons in plain language help volunteer coaches with the problems they see on the pitch.",
      "v4-player-dev": "And players see their own progress against the same five headings their coaches teach.",
    },
    outro: "Growfit. Run your academy like a pro.",
  },

  "05-parents-and-players": {
    intro: "Everyone in the loop, in one tap.",
    parts: {
      "v5-announce": "Write the message once. One tap rewrites it so a 13-year-old can follow it.",
      "v5-parent":
        "Parents get their child's week on their phone: announcements, the next match, what needs signing, and any change, with the reason.",
      "v5-player": "Players get skill challenges from their coach, and see their own growth, season by season.",
    },
    outro: "Growfit. Run your academy like a pro.",
  },

  "06-run-the-academy": {
    intro: "Compliance, reporting and a monthly health check.",
    parts: {
      "v6-overview": "See the whole club at a glance: registration, attendance, ratings, and who needs attention.",
      "v6-health": "Then generate a monthly health report, written from your own numbers.",
      "v6-paperwork": "Track registration paperwork for every player, and export records as CSV or a print-ready PDF.",
    },
    outro: "Growfit. Run your academy like a pro.",
  },
};
