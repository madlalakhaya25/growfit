"use client";

import { useRef, useState } from "react";
import { BookOpenCheck, Plus, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { sendHomework } from "@/app/actions/homework";
import { MAX_OPTIONS, MAX_QUESTIONS, MIN_OPTIONS, OPTION_MAX, PROMPT_MAX, EXPLANATION_MAX, TITLE_MAX } from "@/lib/homework";
import { todayIso } from "@/lib/time";

interface DraftOption { key: string; text: string }
interface DraftQuestion { key: string; prompt: string; options: DraftOption[]; correct: number; explanation: string }

const inputClass =
  "w-full rounded-[10px] border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

function plusDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function useKeys() {
  const n = useRef(0);
  return () => `k${++n.current}`;
}

/**
 * "Send as homework" for a saved play: title, due date and 1 to 3
 * multiple-choice questions. Goes to the play's own team (a play belongs to
 * one team, and only that team's players can open it).
 */
export function SendHomeworkButton({ playId, playName, onNotice }: Readonly<{
  playId: string;
  playName: string;
  onNotice: (msg: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 sm:h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-muted"
      >
        <BookOpenCheck className="size-3 text-primary" aria-hidden="true" /> Send as homework
      </button>
      {open && (
        <SendHomeworkSheet
          playId={playId}
          playName={playName}
          onClose={() => setOpen(false)}
          onSent={() => { setOpen(false); onNotice("Homework sent. Players see it under Learn, then Homework."); }}
        />
      )}
    </>
  );
}

function SendHomeworkSheet({ playId, playName, onClose, onSent }: Readonly<{
  playId: string; playName: string; onClose: () => void; onSent: () => void;
}>) {
  const key = useKeys();
  const today = todayIso();
  const [title, setTitle] = useState(playName.slice(0, TITLE_MAX));
  const [dueDate, setDueDate] = useState(plusDays(today, 3));
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => [newQuestion(key)]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const update = (k: string, change: (q: DraftQuestion) => DraftQuestion) =>
    setQuestions((qs) => qs.map((q) => (q.key === k ? change(q) : q)));

  async function submit() {
    setSending(true);
    setError(null);
    const res = await sendHomework({
      playId,
      title,
      dueDate,
      questions: questions.map((q) => ({
        prompt: q.prompt,
        options: q.options.map((o) => o.text),
        correct: q.correct,
        explanation: q.explanation,
      })),
    });
    setSending(false);
    if (res.error) { setError(res.error); return; }
    onSent();
  }

  return (
    <Sheet open onClose={onClose} title="Send as homework">
      <form
        className="space-y-5"
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <p className="text-sm text-muted-foreground">
          Players watch this play at home, then answer a few quick questions. It also shares the play with the squad.
        </p>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Due date</span>
          <input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
        </label>

        {questions.map((q, i) => (
          <QuestionEditor
            key={q.key}
            number={i + 1}
            question={q}
            canRemove={questions.length > 1}
            onChange={(change) => update(q.key, change)}
            onRemove={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
            newKey={key}
          />
        ))}

        {questions.length < MAX_QUESTIONS && (
          <Button type="button" variant="outline" block onClick={() => setQuestions((qs) => [...qs, newQuestion(key)])}>
            <Plus aria-hidden="true" /> Add a question
          </Button>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" block size="lg" disabled={sending}>
          {sending ? "Sending…" : "Send to the team"}
        </Button>
      </form>
    </Sheet>
  );
}

function newQuestion(key: () => string): DraftQuestion {
  return { key: key(), prompt: "", options: [{ key: key(), text: "" }, { key: key(), text: "" }], correct: 0, explanation: "" };
}

function QuestionEditor({ number, question, canRemove, onChange, onRemove, newKey }: Readonly<{
  number: number;
  question: DraftQuestion;
  canRemove: boolean;
  onChange: (change: (q: DraftQuestion) => DraftQuestion) => void;
  onRemove: () => void;
  newKey: () => string;
}>) {
  const setOption = (k: string, text: string) =>
    onChange((q) => ({ ...q, options: q.options.map((o) => (o.key === k ? { ...o, text } : o)) }));
  const removeOption = (idx: number) =>
    onChange((q) => {
      const options = q.options.filter((_, j) => j !== idx);
      let correct = q.correct;
      if (idx === q.correct) correct = 0;
      else if (idx < q.correct) correct = q.correct - 1;
      return { ...q, options, correct };
    });

  return (
    <fieldset className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <legend className="sr-only">Question {number}</legend>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">Question {number}</p>
        {canRemove && (
          <button type="button" onClick={onRemove} className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label={`Remove question ${number}`}>
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <input
        value={question.prompt}
        onChange={(e) => { const prompt = e.target.value; onChange((q) => ({ ...q, prompt })); }}
        maxLength={PROMPT_MAX}
        placeholder="e.g. When the ball goes wide, where does the 8 run?"
        aria-label={`Question ${number}`}
        className={inputClass}
      />
      <p className="text-xs text-muted-foreground">Tick the right answer.</p>
      <ul className="space-y-2">
        {question.options.map((o, j) => (
          <li key={o.key} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.key}`}
              checked={question.correct === j}
              onChange={() => onChange((q) => ({ ...q, correct: j }))}
              aria-label={`Answer ${j + 1} is right`}
              className="size-5 shrink-0 accent-primary"
            />
            <input
              value={o.text}
              onChange={(e) => setOption(o.key, e.target.value)}
              maxLength={OPTION_MAX}
              placeholder={`Answer ${j + 1}`}
              aria-label={`Question ${number}, answer ${j + 1}`}
              className={inputClass}
            />
            {question.options.length > MIN_OPTIONS && (
              <button type="button" onClick={() => removeOption(j)} className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted" aria-label={`Remove answer ${j + 1}`}>
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {question.options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => onChange((q) => ({ ...q, options: [...q.options, { key: newKey(), text: "" }] }))}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
        >
          <Plus className="size-4" aria-hidden="true" /> Add an answer
        </button>
      )}
      <textarea
        value={question.explanation}
        onChange={(e) => { const explanation = e.target.value; onChange((q) => ({ ...q, explanation })); }}
        maxLength={EXPLANATION_MAX}
        rows={2}
        placeholder="Why it's right (optional, shown after they answer)"
        aria-label={`Question ${number}, explanation`}
        className={inputClass}
      />
    </fieldset>
  );
}
