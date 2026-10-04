/**
 * Tactics homework: a coach sends a saved play with a short quiz, players do
 * it at home. Pure validation, scoring and summary helpers; no database.
 *
 * The same shape is checked again in the database (migration 063,
 * `homework_questions_valid`), and the score is recomputed there by a trigger,
 * so a player cannot write their own score. These helpers exist so the app can
 * say what is wrong in plain words before the database refuses it.
 */

export const MAX_QUESTIONS = 3;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
export const PROMPT_MAX = 200;
export const OPTION_MAX = 100;
export const EXPLANATION_MAX = 300;
export const TITLE_MAX = 80;
/** How far ahead a due date may be set. */
export const DUE_MAX_DAYS = 60;

export interface HomeworkQuestion {
  prompt: string;
  options: string[];
  /** Index into options of the one correct answer. */
  correct: number;
  explanation?: string;
}

/** What a player sees before answering: no correct answer, no explanation. */
export interface HomeworkQuestionForPlayer {
  /** Stable per assignment ("q1", "q2", ...), for list keys. */
  id: string;
  prompt: string;
  options: string[];
}

export interface QuestionFeedback {
  chosen: number;
  correct: number;
  right: boolean;
  explanation: string | null;
}

/** A missing table is "not set up yet", never an error on screen. */
export function isMissingHomeworkTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const trimmed = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function validateOptions(raw: unknown, n: number): { options?: string[]; error?: string } {
  if (!Array.isArray(raw) || raw.length < MIN_OPTIONS || raw.length > MAX_OPTIONS) {
    return { error: `Question ${n} needs ${MIN_OPTIONS} to ${MAX_OPTIONS} answers to pick from.` };
  }
  const options = raw.map(trimmed);
  if (options.some((o) => !o)) return { error: `Question ${n} has an empty answer. Fill it in or remove it.` };
  if (options.some((o) => o.length > OPTION_MAX)) return { error: `Keep each answer in question ${n} under ${OPTION_MAX} characters.` };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return { error: `Question ${n} has the same answer twice.` };
  }
  return { options };
}

function validateQuestion(raw: unknown, n: number): { question?: HomeworkQuestion; error?: string } {
  if (!isRecord(raw)) return { error: `Question ${n} is missing.` };
  const prompt = trimmed(raw.prompt);
  if (!prompt) return { error: `Write question ${n}.` };
  if (prompt.length > PROMPT_MAX) return { error: `Keep question ${n} under ${PROMPT_MAX} characters.` };
  const { options, error } = validateOptions(raw.options, n);
  if (!options) return { error };
  const correct = raw.correct;
  if (typeof correct !== "number" || !Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return { error: `Pick the right answer for question ${n}.` };
  }
  const explanation = trimmed(raw.explanation);
  if (explanation.length > EXPLANATION_MAX) return { error: `Keep the explanation for question ${n} under ${EXPLANATION_MAX} characters.` };
  return { question: explanation ? { prompt, options, correct, explanation } : { prompt, options, correct } };
}

/** 1 to 3 multiple-choice questions, each with 2 to 4 answers and exactly one right one. */
export function validateQuestions(raw: unknown): { questions?: HomeworkQuestion[]; error?: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Add at least one question." };
  if (raw.length > MAX_QUESTIONS) return { error: `Keep it short: ${MAX_QUESTIONS} questions at most.` };
  const questions: HomeworkQuestion[] = [];
  for (let i = 0; i < raw.length; i++) {
    const { question, error } = validateQuestion(raw[i], i + 1);
    if (!question) return { error };
    questions.push(question);
  }
  return { questions };
}

export function validateTitle(raw: unknown): { title?: string; error?: string } {
  const title = trimmed(raw);
  if (!title) return { error: "Give the homework a title." };
  if (title.length > TITLE_MAX) return { error: `Keep the title under ${TITLE_MAX} characters.` };
  return { title };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A real YYYY-MM-DD date from today up to DUE_MAX_DAYS ahead. `today` is the academy's date. */
export function validateDueDate(raw: unknown, today: string): { dueDate?: string; error?: string } {
  const s = trimmed(raw);
  if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`)) || addDays(s, 0) !== s) {
    return { error: "Pick a due date." };
  }
  if (s < today) return { error: "The due date has already passed." };
  if (s > addDays(today, DUE_MAX_DAYS)) return { error: `Pick a due date within ${DUE_MAX_DAYS} days.` };
  return { dueDate: s };
}

/** One chosen option index per question, each in range. */
export function validateAnswers(questions: readonly HomeworkQuestion[], raw: unknown): { answers?: number[]; error?: string } {
  if (!Array.isArray(raw) || raw.length !== questions.length) return { error: "Answer every question first." };
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a >= questions[i].options.length) {
      return { error: "Answer every question first." };
    }
  }
  return { answers: raw as number[] };
}

/** How many answers were right. Answers are assumed validated. */
export function scoreAnswers(questions: readonly HomeworkQuestion[], answers: readonly number[]): number {
  return questions.reduce((n, q, i) => (answers[i] === q.correct ? n + 1 : n), 0);
}

export function feedbackFor(questions: readonly HomeworkQuestion[], answers: readonly number[]): QuestionFeedback[] {
  return questions.map((q, i) => ({
    chosen: answers[i],
    correct: q.correct,
    right: answers[i] === q.correct,
    explanation: q.explanation ?? null,
  }));
}

export function forPlayer(questions: readonly HomeworkQuestion[]): HomeworkQuestionForPlayer[] {
  return questions.map((q, i) => ({ id: `q${i + 1}`, prompt: q.prompt, options: [...q.options] }));
}

/** Kind words for a result. Never a telling-off. */
export function resultMessage(score: number, total: number): string {
  const tally = `${score} of ${total}`;
  if (total > 0 && score === total) return `${tally}, all right! You know this play.`;
  if (score * 2 >= total) return `${tally}, nice! Here's why for the others.`;
  return `${tally}. Good effort. Have a look at why below, then watch the play again.`;
}

/** Below half right: worth a word from the coach at the next session. */
export function struggled(score: number, total: number): boolean {
  return total > 0 && score * 2 < total;
}

export interface RosterPlayer { id: string; name: string }
export interface ResponseRow { player_id: string; score: number; total: number; answers: number[]; completed_at: string }

export interface PlayerProgress {
  playerId: string;
  name: string;
  done: boolean;
  score: number | null;
  total: number | null;
  struggled: boolean;
}

export interface HomeworkSummary {
  players: PlayerProgress[];
  doneCount: number;
  /** Per question: how many who answered got it wrong. */
  missedPerQuestion: number[];
}

/**
 * Who has done it, their score, and which questions tripped people up. Players
 * who struggled come first, then the rest done, then not yet, each by name.
 */
export function summariseHomework(
  questions: readonly HomeworkQuestion[],
  roster: readonly RosterPlayer[],
  responses: readonly ResponseRow[],
): HomeworkSummary {
  const byPlayer = new Map(responses.map((r) => [r.player_id, r]));
  const rank = (p: PlayerProgress) => {
    if (p.struggled) return 0;
    return p.done ? 1 : 2;
  };
  const players = roster
    .map((p): PlayerProgress => {
      const r = byPlayer.get(p.id);
      if (!r) return { playerId: p.id, name: p.name, done: false, score: null, total: null, struggled: false };
      return { playerId: p.id, name: p.name, done: true, score: r.score, total: r.total, struggled: struggled(r.score, r.total) };
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  const onRoster = responses.filter((r) => roster.some((p) => p.id === r.player_id));
  const missedPerQuestion = questions.map((q, i) =>
    onRoster.reduce((n, r) => (Array.isArray(r.answers) && r.answers[i] !== q.correct ? n + 1 : n), 0),
  );
  return { players, doneCount: onRoster.length, missedPerQuestion };
}
