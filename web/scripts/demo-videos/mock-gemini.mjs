// A stand-in for Gemini, for recording the AI-assistant demo clip without a live model.
//
//   node scripts/demo-videos/mock-gemini.mjs            # listens on :4010
//   GOOGLE_GEMINI_BASE_URL=http://localhost:4010 GEMINI_API_KEY=demo npm start
//
// WHAT IS REAL AND WHAT IS SCRIPTED. The app is untouched: it still builds the squad
// brief from the database, calls the SDK, parses the reply and renders it, and "Save to
// board" still writes a real play. Only the model's WORDING is scripted here.
//
// The scripted text is written against the seed data (supabase/seed.sql + seed_demo.sql):
// Sanele Buthelezi and Thulani Nkosi at 40% attendance, Thulani checked in on 15 Nov,
// Chatsworth United away on Thursday, never played before. If the seed changes, re-read
// the replies below. Do not use this to claim what the product's model will say: it is
// footage of the interface, with representative wording.
import http from "node:http";

const PORT = Number(process.env.MOCK_GEMINI_PORT ?? 4010);

// Preferred order of picks, best attendance and form first. Sanele and Thulani (40%) come last.
const ORDER = [
  ["Buhle Ngcobo", "CB", "Rated 4.25 on average and a reliable 90% at training. Leads the back line."],
  ["Nkosana Dlamini", "CB", "Has not missed a session. Left-footed, which gives the defence balance."],
  ["Lindiwe Mahlangu", "LB", "80% attendance, and late counts as turned up. Comfortable stepping up the left."],
  ["Mpho Radebe", "CDM", "Perfect attendance, and he broke up two counters against Sundowns."],
  ["Zanele Mkhize", "CM", "Top of the ratings at 4.50 with 100% attendance."],
  ["Ayanda Zungu", "LW", "Scored twice against Sundowns Youth Academy and has not missed training."],
  ["Kagiso Mokoena", "ST", "Rated 4.33 and 100% at training. Needs the minutes from the start."],
  ["Sanele Buthelezi", "RB", "Starts only because we have ten players. 40% attendance, so check in with him first."],
  ["Thulani Nkosi", "RW", "Quick, but 40% attendance this term, so he is a substitute option."],
];

function outfieldCount(formation) {
  const m = /^(\d(?:-\d)+)/.exec(formation.trim());
  return m ? m[1].split("-").reduce((a, b) => a + Number(b), 0) : 8;
}

function lineup(formation) {
  const n = Math.min(outfieldCount(formation), ORDER.length);
  const outfield = ORDER.slice(0, n);
  const bench = ORDER.slice(n).map(([name]) => name);
  return {
    shape: formation,
    startingXI: [
      { position: "GK", name: "Asanda Khumalo", reason: "Rated 4.25 on average, commands the box and trains 90% of the time." },
      ...outfield.map(([name, position, reason]) => ({ position, name, reason })),
    ],
    bench,
    mustGetMinutes: [
      {
        name: "Thulani Nkosi",
        why: "40% attendance and a transport problem the family has mentioned. Playing time is the reason to keep coming, so bring him on early in the second half and follow up on the lift-share.",
      },
    ],
    notes:
      "A settled back line with Mpho and Zanele protecting it, and Ayanda and Kagiso as the outlets. The risk is Sanele: he has trained 4 of the last 10 sessions, so use Wednesday's session to see how he looks before Thursday.",
  };
}

const PLAN = {
  planSummary: "Stay compact, win the ball back quickly, and play forward to Ayanda and Kagiso.",
  shapeAndWhy:
    "We keep a compact back line with Mpho in front of it. We have never played Chatsworth United, so the plan rests on our own strengths and on what we see in the warm-up.",
  inPossession: [
    "Buhle and Nkosana split wide and Mpho drops between them to start attacks.",
    "Look for Ayanda on the left early, because she scored twice the last time she had space there.",
    "Zanele makes the second run beyond Kagiso, so he is never alone up front.",
  ],
  outOfPossession: [
    "Kagiso and Ayanda press the first pass, and the midfield squeezes behind them.",
    "If we lose the ball, three seconds to win it back before dropping into shape.",
    "Lindiwe and Sanele stay narrow when the ball is on the other side.",
  ],
  setPieces: {
    attacking: "Short corner to Zanele, with Kagiso attacking the near post.",
    defending: "Zonal on the six-yard box, with Buhle marking the tallest attacker.",
  },
  keyPlayers: [
    { name: "Ayanda Zungu", job: "Stretch the left side and score. Rated 5 against Sundowns." },
    { name: "Mpho Radebe", job: "Break up their counters and start our attacks." },
  ],
  worries: [
    "Sanele Buthelezi and Thulani Nkosi are both at 40% attendance, so we cannot rely on either to know the shape.",
    "Only one session (Wednesday) before an away match, and the travel is long. Sort the lift-share before Thursday.",
  ],
  teamTalk: [
    "Win it back quickly, together.",
    "Pass forward when it is on, and pass safe when it is not.",
    "Look after each other when it gets hard.",
  ],
  rehearseAtTraining: "Wednesday's match-prep session: pressing triggers, then ten minutes of finishing under pressure.",
};

const CHAT = [
  [
    /welfare|check-?in|missing training|attendance/i,
    "Two players are below the 75% attendance line over the last 90 days.\n\n" +
      "Sanele Buthelezi: 40% (4 of 10 sessions). He has never had a welfare check-in, so start there.\n" +
      "Thulani Nkosi: 40% (4 of 10 sessions). Sipho checked in on 15 Nov and the family said transport is the problem, so a lift-share could fix it.\n\n" +
      "Everyone else is at 80% or above. Remember the policy is a conversation, not a punishment.",
  ],
  [
    /improv|form|best|top/i,
    "Zanele Mkhize leads the ratings at 4.50, and Kagiso Mokoena is next at 4.33. Both are at 100% attendance, so the form and the work rate are lining up.",
  ],
];
const FALLBACK =
  "I can help with attendance, form, who to start and what to work on at training. Try asking who needs a welfare check-in.";


// ── Session planner ───────────────────────────────────────────────────────
// Five drills in the FIFA five-phase shape the app asks for (activation, technical, tactical,
// small-sided game, reflection), on the theme of winning the ball back. Diagrams are drawn in
// board units: grid-small is 60x60, grid-large is 60x80.
const DRILLS = [
  {
    name: "Rondo 4v2 with a three-second rule",
    durationMinutes: 12,
    ltpdFocus: "First touch and scanning before receiving",
    fourCorner: "Technical",
    setup: "Two 10m x 10m grids. 4 players on the outside, 2 defenders in the middle, 1 ball per grid, bibs for the defenders.",
    instructions:
      "1. Four outside players pass to keep the ball from the two defenders.\n2. When a defender wins it, the player who lost it swaps in.\n3. After 90 seconds, rotate the defenders.\n4. Progress: players must scan before every pass and play two-touch.",
    coachingPoints: "Look before the ball arrives. Open your body so you can pass either way.",
    diagram: {
      pitch: "grid-small",
      tokens: [
        { role: "team", x: 14, y: 14 }, { role: "team", x: 46, y: 14 }, { role: "team", x: 46, y: 46 }, { role: "team", x: 14, y: 46 },
        { role: "opponent", x: 26, y: 30 }, { role: "opponent", x: 36, y: 32 }, { role: "ball", x: 17, y: 16 },
      ],
      equipment: [
        { kind: "cone", x: 8, y: 8 }, { kind: "cone", x: 52, y: 8 }, { kind: "cone", x: 52, y: 52 }, { kind: "cone", x: 8, y: 52 },
      ],
      moves: [{ kind: "pass", from: 0, toToken: 1 }, { kind: "pass", from: 1, toToken: 2 }, { kind: "press", from: 4, x: 40, y: 20 }],
    },
  },
  {
    name: "Counter-press box: win it back in three seconds",
    durationMinutes: 12,
    ltpdFocus: "Reacting immediately when the ball is lost",
    fourCorner: "Tactical",
    setup: "A 20m x 30m grid with a mini goal at each end. 4v4 plus a neutral. Bibs for two teams.",
    instructions:
      "1. Play 4v4 with the neutral player always on the team with the ball.\n2. The moment a team loses the ball, they have three seconds to win it back.\n3. Win it back inside three seconds and the team scores a bonus point.\n4. Stop and ask: who was closest, who covered?",
    coachingPoints: "The nearest player presses at once; the others close the passing lanes behind them.",
    diagram: {
      pitch: "grid-large",
      tokens: [
        { role: "team", x: 18, y: 28 }, { role: "team", x: 42, y: 28 }, { role: "team", x: 22, y: 46 }, { role: "team", x: 40, y: 50 },
        { role: "opponent", x: 24, y: 38 }, { role: "opponent", x: 38, y: 36 }, { role: "opponent", x: 20, y: 56 }, { role: "opponent", x: 44, y: 60 },
        { role: "ball", x: 26, y: 40 },
      ],
      equipment: [{ kind: "mini-goal", x: 30, y: 6 }, { kind: "mini-goal", x: 30, y: 74 }],
      moves: [{ kind: "press", from: 0, toToken: 4 }, { kind: "press", from: 2, toToken: 4 }, { kind: "run", from: 1, x: 38, y: 40 }],
    },
  },
  {
    name: "Defending 1v1 in the channel",
    durationMinutes: 12,
    ltpdFocus: "Delaying and guiding the attacker",
    fourCorner: "Tactical",
    setup: "Four lanes, each 5m x 15m, with a small goal at the end. Attackers and defenders in pairs.",
    instructions:
      "1. The attacker dribbles at the defender and tries to score in the small goal.\n2. The defender closes down quickly, then slows down and steers the attacker wide.\n3. Swap roles after every turn.\n4. Progress: a second defender covers from behind.",
    coachingPoints: "Get close quickly, then slow down. Show the attacker to their weaker side.",
    diagram: {
      pitch: "grid-small",
      tokens: [
        { role: "team", x: 14, y: 50 }, { role: "opponent", x: 14, y: 26 },
        { role: "team", x: 40, y: 50 }, { role: "opponent", x: 40, y: 26 }, { role: "ball", x: 16, y: 48 },
      ],
      equipment: [{ kind: "mini-goal", x: 14, y: 6 }, { kind: "mini-goal", x: 40, y: 6 }, { kind: "cone", x: 27, y: 52 }, { kind: "cone", x: 27, y: 12 }],
      moves: [{ kind: "dribble", from: 0, x: 14, y: 30 }, { kind: "press", from: 1, toToken: 0 }, { kind: "dribble", from: 2, x: 40, y: 30 }],
    },
  },
  {
    name: "Transition game 5v5 with a counter-goal",
    durationMinutes: 20,
    ltpdFocus: "Switching quickly between attacking and defending",
    fourCorner: "Tactical",
    setup: "A 30m x 40m pitch, a goal at each end, and two small counter-goals on the halfway line. 5v5 plus keepers.",
    instructions:
      "1. Play 5v5 to the big goals.\n2. When a team wins the ball it can score in a small counter-goal for two points.\n3. The team that lost the ball must win it back or drop into shape.\n4. Play three 5-minute rounds with a 1-minute coaching stop between them.",
    coachingPoints: "Look forward the moment you win it. If you lose it, the closest player presses and everyone else gets goal-side.",
    diagram: {
      pitch: "grid-large",
      tokens: [
        { role: "keeper", x: 30, y: 8 }, { role: "team", x: 18, y: 30 }, { role: "team", x: 42, y: 30 }, { role: "team", x: 22, y: 46 }, { role: "team", x: 38, y: 46 },
        { role: "opponent", x: 24, y: 36 }, { role: "opponent", x: 36, y: 36 }, { role: "opponent", x: 18, y: 56 }, { role: "opponent", x: 42, y: 56 }, { role: "ball", x: 30, y: 40 },
      ],
      equipment: [{ kind: "goal", x: 30, y: 4 }, { kind: "goal", x: 30, y: 76 }, { kind: "mini-goal", x: 8, y: 40 }, { kind: "mini-goal", x: 52, y: 40 }],
      moves: [{ kind: "run", from: 1, x: 18, y: 18 }, { kind: "pass", from: 2, toToken: 1 }, { kind: "press", from: 6, toToken: 2 }],
    },
  },
  {
    name: "Conditioned match 7v7: reward the win-back",
    durationMinutes: 15,
    ltpdFocus: "Applying pressing and recovery in a realistic game",
    fourCorner: "Social",
    setup: "A 40m x 50m pitch with normal goals, 7v7, bibs for two teams. Coaches on the touchline.",
    instructions:
      "1. Play a normal 7v7 match.\n2. Any goal scored within ten seconds of winning the ball counts double.\n3. Stop once at each end to ask the team what they noticed.\n4. Finish with a 3-minute cool-down walk and stretch.",
    coachingPoints: "Talk early and loudly. Support the player who wins the ball.",
    diagram: {
      pitch: "grid-large",
      tokens: [
        { role: "keeper", x: 30, y: 6 }, { role: "team", x: 14, y: 22 }, { role: "team", x: 46, y: 22 }, { role: "team", x: 30, y: 34 }, { role: "team", x: 20, y: 48 }, { role: "team", x: 40, y: 48 },
        { role: "opponent", x: 24, y: 40 }, { role: "opponent", x: 36, y: 40 }, { role: "opponent", x: 14, y: 58 }, { role: "opponent", x: 46, y: 58 }, { role: "ball", x: 32, y: 36 },
      ],
      equipment: [{ kind: "goal", x: 30, y: 3 }, { kind: "goal", x: 30, y: 77 }],
      moves: [{ kind: "pass", from: 3, toToken: 2 }, { kind: "run", from: 4, x: 20, y: 30 }],
    },
  },
];

const SESSION_PLAN = {
  drills: DRILLS.map(({ diagram, ...d }) => d),
  coachReflection:
    "When we lost the ball today, who reacted first, and what did the rest of the team do in the next three seconds?",
};

// ── Opponent scouting ─────────────────────────────────────────────────────
const SCOUTING =
  "WHAT WE KNOW\nChatsworth United are away on Thursday 26 November at Chatsworth Stadium. We have never played them, so there is no result, formation or player information logged.\n\n" +
  "WHAT TO CHECK IN THE WARM-UP\nWatch how they warm up: which foot their wide players favour, who takes the set pieces, and whether their goalkeeper plays out or kicks long. Note who looks quickest in the first five minutes.\n\n" +
  "HOW THIS SHOULD SHAPE OUR PLAN\nWith no history to rely on, play to our own strengths: Ayanda and Kagiso up front and Mpho protecting the back line. Keep the shape compact for the first ten minutes and adjust once we have seen what they do.";

// ── Announcement, simplified for the age group ────────────────────────────
function simplifyNote(prompt) {
  const note = prompt.split("\n\n").slice(1).join("\n\n").trim();
  if (/Thursday 26 Nov/.test(note) && /18:59/.test(note) && /17:30/.test(note)) {
    return "Match day is on Thursday 26 Nov. The game starts at 18:59 at Chatsworth Stadium. Please meet at Riverside Grounds at 17:30 and bring both kits.";
  }
  return note;
}

// ── Reports that quote the data they were given ───────────────────────────
function pick(re, text, fallback = "n/a") { return re.exec(text)?.[1]?.trim() ?? fallback; }

function academyHealth(prompt) {
  const players = pick(/Total active players: (\d+)/, prompt);
  const comp = pick(/Document compliance: (\d+)%/, prompt);
  const docs = pick(/Document compliance: \d+% \(([^)]+)\)/, prompt);
  const rating = pick(/Average player rating this month: ([\d.]+)/, prompt);
  const sessions = pick(/Training sessions this month: (\d+)/, prompt);
  const miles = pick(/Milestones completed this season: (\d+)/, prompt);
  const top = pick(/Top performers: ([^\n]+)/, prompt);
  return [
    `1. ACADEMY OVERVIEW: The academy has ${players} active players, with ${docs} (${comp}%) and an average rating of ${rating} out of 5 this month. Training is running steadily, with ${sessions} sessions logged this month.`,
    `2. STRENGTHS:\n- Match ratings are healthy at ${rating} out of 5, with ${top} leading.\n- ${miles} development milestones are already complete this season, so progress is being recorded, not just planned.`,
    `3. CONCERNS:\n- Document compliance is ${comp}%, below the 80% SAFA benchmark needed before competitive play.\n- ${sessions} sessions this month is under the SAFA NDP standard of 12 or more.`,
    "4. PRIORITY ACTIONS:\n- Chase the outstanding forms this week, starting with the players missing a single document.\n- Add training sessions so each team reaches the NDP minimum.\n- Hold welfare check-ins for players below 75% attendance.",
    "5. DIRECTOR'S NOTE: The foundations are in place; closing the paperwork gap and the training volume will turn good data into a stronger season.",
    "6. SAFA PATHWAY ALIGNMENT: Recording ratings, attendance and milestones for every player matches the structured player tracking SAFA's National Development Programme expects.",
  ].join("\n\n");
}

function playerInsight(prompt) {
  const name = pick(/- Name: ([^\n]+)/, prompt, "The player");
  const first = name.split(" ")[0];
  const ratings = pick(/Match Ratings \(Last 10\): ([^\n]+)/, prompt, "none recorded");
  return [
    `1. STRENGTHS:\n- ${name} is rated consistently across the matches logged (${ratings}), which points to reliable technical habits (Technical).\n- Completed development milestones show ${first} responding to coaching and taking responsibility in the group (Social/Psychological).`,
    `2. PRIORITY DEVELOPMENT:\n- ${first} should keep building decision-making under pressure, which is the main step for this phase of development (Tactical).\n- Add more physical literacy work, such as balance and quick changes of direction, to support growth (Physical).`,
    "3. RECOMMENDED DRILLS:\n- Rondo 4v2 with a scanning rule, to speed up decisions before receiving.\n- 1v1 defending in channels, to practise delaying and guiding.",
    `4. PATHWAY READINESS: ${first} is progressing well for the current phase and is ready to take on more positional responsibility.`,
    `5. MOTIVATIONAL NOTE: ${first}'s steady work is showing in the ratings, so keep recognising it in training.`,
  ].join("\n\n");
}

function flatten(contents) {
  const turns = typeof contents === "string" ? [{ role: "user", parts: [{ text: contents }] }] : contents ?? [];
  return turns.map((t) => ({ role: t.role ?? "user", text: (t.parts ?? []).map((p) => p.text ?? "").join("\n") }));
}

function reply(body) {
  const turns = flatten(body.contents);
  const all = turns.map((t) => t.text).join("\n");
  const last = [...turns].reverse().find((t) => t.role === "user")?.text ?? "";

  if (all.includes("Pick a starting XI from this squad")) {
    const formation = /playing ([^\n]+?)\.\n/.exec(all)?.[1] ?? "3-3-2";
    return JSON.stringify(lineup(formation));
  }
  if (all.includes("Write the match plan for this team")) return JSON.stringify(PLAN);
  if (all.includes("Generate a complete, structured training session plan")) return JSON.stringify(SESSION_PLAN);
  if (/drill diagram|Coordinates: x runs left to right/i.test(all)) {
    return JSON.stringify({ diagrams: DRILLS.map((d, i) => ({ drill: i, diagram: d.diagram })) });
  }
  if (all.includes("Write a short scouting report on this opponent")) return SCOUTING;
  if (all.includes("Rewrite this note from a youth football coach")) return simplifyNote(all);
  if (all.includes("produce a strategic monthly health report")) return academyHealth(all);
  if (all.includes("technical player evaluation for the coaching staff")) return playerInsight(all);

  const question = last.split("\n").filter(Boolean).pop() ?? last;
  return (CHAT.find(([re]) => re.test(question)) ?? [null, FALLBACK])[1];
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const json = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
      if (/cachedContents/.test(req.url)) {
        // The app falls back to sending the brief inline when no context cache can be had.
        return json(400, { error: { code: 400, message: "context caching is not scripted", status: "INVALID_ARGUMENT" } });
      }
      if (!/:generateContent/.test(req.url)) return json(404, { error: { code: 404, message: "not scripted", status: "NOT_FOUND" } });
      let body = {};
      try { body = JSON.parse(raw); } catch {}
      const text = reply(body);
      console.error(`[mock-gemini] ${req.url.split("?")[0]} -> ${text.length} chars`);
      setTimeout(
        () =>
          json(200, {
            candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP", index: 0 }],
            usageMetadata: { promptTokenCount: 900, candidatesTokenCount: Math.ceil(text.length / 4), totalTokenCount: 900 + Math.ceil(text.length / 4) },
            modelVersion: "scripted-demo",
          }),
        // A believable beat, so the spinner is visible, as it would be with a live model.
        1800,
      );
    });
  })
  .listen(PORT, () => console.error(`[mock-gemini] scripted replies on http://localhost:${PORT}`));
