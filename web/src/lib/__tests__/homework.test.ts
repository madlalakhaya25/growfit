import {
  feedbackFor, forPlayer, isMissingHomeworkTable, resultMessage, scoreAnswers, struggled, summariseHomework,
  validateAnswers, validateDueDate, validateQuestions, validateTitle, type HomeworkQuestion,
} from "../homework";

const q = (over: Partial<HomeworkQuestion> = {}): HomeworkQuestion => ({
  prompt: "Where does the 8 run?", options: ["Wide", "Into the box", "Back"], correct: 1, ...over,
});

describe("validateQuestions", () => {
  it("accepts 1 to 3 questions and trims text", () => {
    const res = validateQuestions([{ prompt: "  Who presses? ", options: [" 9 ", "6"], correct: 0, explanation: " The 9 starts it. " }]);
    expect(res).toEqual({ questions: [{ prompt: "Who presses?", options: ["9", "6"], correct: 0, explanation: "The 9 starts it." }] });
  });

  it("drops an empty explanation", () => {
    expect(validateQuestions([{ prompt: "Q", options: ["A", "B"], correct: 1, explanation: "  " }]).questions?.[0]).toEqual({ prompt: "Q", options: ["A", "B"], correct: 1 });
  });

  it.each([
    ["none", [], /at least one/],
    ["not an array", "x", /at least one/],
    ["four questions", [q(), q(), q(), q()], /3 questions at most/],
    ["no prompt", [q({ prompt: " " })], /Write question 1/],
    ["long prompt", [q({ prompt: "x".repeat(201) })], /under 200/],
    ["one option", [q({ options: ["A"], correct: 0 })], /2 to 4/],
    ["five options", [q({ options: ["A", "B", "C", "D", "E"] })], /2 to 4/],
    ["empty option", [q({ options: ["A", " "] , correct: 0 })], /empty answer/],
    ["duplicate option", [q({ options: ["Wide", "wide"], correct: 0 })], /same answer twice/],
    ["correct out of range", [q({ correct: 3 })], /Pick the right answer/],
    ["correct negative", [q({ correct: -1 })], /Pick the right answer/],
    ["correct not integer", [q({ correct: 0.5 })], /Pick the right answer/],
    ["long explanation", [q({ explanation: "x".repeat(301) })], /under 300/],
    ["second question bad", [q(), { prompt: "Q2" }], /Question 2 needs/],
  ])("refuses %s", (_name, raw, msg) => {
    const res = validateQuestions(raw);
    expect(res.questions).toBeUndefined();
    expect(res.error).toMatch(msg);
  });
});

describe("validateTitle", () => {
  it("trims and bounds", () => {
    expect(validateTitle("  Press ")).toEqual({ title: "Press" });
    expect(validateTitle(" ").error).toMatch(/title/);
    expect(validateTitle("x".repeat(81)).error).toMatch(/80/);
  });
});

describe("validateDueDate", () => {
  const today = "2026-10-04";
  it("accepts today up to 60 days ahead", () => {
    expect(validateDueDate("2026-10-04", today)).toEqual({ dueDate: "2026-10-04" });
    expect(validateDueDate("2026-12-03", today)).toEqual({ dueDate: "2026-12-03" });
  });
  it("refuses the past, too far ahead, and nonsense", () => {
    expect(validateDueDate("2026-10-03", today).error).toMatch(/passed/);
    expect(validateDueDate("2026-12-04", today).error).toMatch(/within 60/);
    expect(validateDueDate("2026-02-30", today).error).toMatch(/Pick a due date/);
    expect(validateDueDate("tomorrow", today).error).toMatch(/Pick a due date/);
    expect(validateDueDate(undefined, today).error).toMatch(/Pick a due date/);
  });
});

describe("answers and scoring", () => {
  const qs = [q(), q({ options: ["A", "B"], correct: 0, explanation: "Because" })];

  it("validates one in-range answer per question", () => {
    expect(validateAnswers(qs, [1, 0])).toEqual({ answers: [1, 0] });
    expect(validateAnswers(qs, [1]).error).toMatch(/every question/);
    expect(validateAnswers(qs, [1, 2]).error).toMatch(/every question/);
    expect(validateAnswers(qs, [1, null]).error).toMatch(/every question/);
    expect(validateAnswers(qs, "1,0").error).toMatch(/every question/);
  });

  it("scores right answers only", () => {
    expect(scoreAnswers(qs, [1, 0])).toBe(2);
    expect(scoreAnswers(qs, [0, 0])).toBe(1);
    expect(scoreAnswers(qs, [2, 1])).toBe(0);
  });

  it("gives feedback with the right answer and explanation", () => {
    expect(feedbackFor(qs, [0, 0])).toEqual([
      { chosen: 0, correct: 1, right: false, explanation: null },
      { chosen: 0, correct: 0, right: true, explanation: "Because" },
    ]);
  });

  it("never sends a player the key before they answer", () => {
    const shown = forPlayer(qs);
    expect(shown).toEqual([
      { id: "q1", prompt: q().prompt, options: q().options },
      { id: "q2", prompt: q().prompt, options: ["A", "B"] },
    ]);
    expect(JSON.stringify(shown)).not.toMatch(/correct|explanation|Because/);
  });

  it("words the result kindly", () => {
    expect(resultMessage(3, 3)).toMatch(/^3 of 3, all right/);
    expect(resultMessage(2, 3)).toBe("2 of 3, nice! Here's why for the others.");
    expect(resultMessage(1, 2)).toMatch(/nice/);
    expect(resultMessage(0, 3)).toMatch(/Good effort/);
    expect(struggled(1, 3)).toBe(true);
    expect(struggled(1, 2)).toBe(false);
    expect(struggled(0, 0)).toBe(false);
  });
});

describe("summariseHomework", () => {
  const qs = [q(), q({ options: ["A", "B"], correct: 0 })];
  const roster = [{ id: "a", name: "Zola" }, { id: "b", name: "Ayanda" }, { id: "c", name: "Bheki" }, { id: "d", name: "Cebo" }];
  const responses = [
    { player_id: "a", answers: [1, 0], score: 2, total: 2, completed_at: "x" },
    { player_id: "b", answers: [0, 1], score: 0, total: 2, completed_at: "x" },
    { player_id: "c", answers: [1, 1], score: 1, total: 2, completed_at: "x" },
    { player_id: "gone", answers: [0, 1], score: 0, total: 2, completed_at: "x" },
  ];

  it("puts who struggled first, then done, then not yet", () => {
    const s = summariseHomework(qs, roster, responses);
    expect(s.players.map((p) => [p.name, p.done, p.score, p.struggled])).toEqual([
      ["Ayanda", true, 0, true],
      ["Bheki", true, 1, false],
      ["Zola", true, 2, false],
      ["Cebo", false, null, false],
    ]);
    expect(s.doneCount).toBe(3);
  });

  it("counts misses per question for players on the roster only", () => {
    expect(summariseHomework(qs, roster, responses).missedPerQuestion).toEqual([1, 2]);
  });
});

it("recognises a missing table, not a missing column", () => {
  expect(isMissingHomeworkTable({ code: "42P01" })).toBe(true);
  expect(isMissingHomeworkTable({ code: "PGRST205" })).toBe(true);
  expect(isMissingHomeworkTable({ code: "42703" })).toBe(false);
  expect(isMissingHomeworkTable(null)).toBe(false);
});
