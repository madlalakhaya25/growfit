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
