"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { submitHomework } from "@/app/actions/homework";
import type { HomeworkQuestionForPlayer, QuestionFeedback } from "@/lib/homework";
import { cn } from "@/lib/utils";

interface Result { score: number; total: number; message: string; feedback: QuestionFeedback[] }

/** The questions, then a kind result with the why for each one. One go only. */
export function HomeworkQuiz({ homeworkId, questions, initialResult }: Readonly<{
  homeworkId: string;
  questions: HomeworkQuestionForPlayer[];
  initialResult: Result | null;
}>) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [result, setResult] = useState<Result | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (result) return <QuizResult questions={questions} result={result} />;

  const ready = answers.every((a) => a !== null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await submitHomework(homeworkId, answers);
    setSaving(false);
    if (res.error || res.score === undefined || !res.feedback) { setError(res.error ?? "Couldn't save your answers. Try again."); return; }
    setResult({ score: res.score, total: res.total ?? questions.length, message: res.message ?? "", feedback: res.feedback });
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {questions.map((q, i) => (
        <Card key={q.id} className="p-4">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">
              <span className="text-muted-foreground">Question {i + 1}. </span>{q.prompt}
            </legend>
            <div className="space-y-2">
              {q.options.map((opt, j) => (
                <label
                  key={opt}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 text-sm",
                    answers[i] === j ? "border-primary bg-primary/10" : "border-border bg-background",
                  )}
                >
                  <input
                    type="radio"
                    name={`q-${i}`}
                    checked={answers[i] === j}
                    onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))}
                    className="size-5 shrink-0 accent-primary"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
      ))}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" block size="lg" disabled={!ready || saving}>
        {saving ? "Saving…" : "Check my answers"}
      </Button>
    </form>
  );
}

function QuizResult({ questions, result }: Readonly<{ questions: HomeworkQuestionForPlayer[]; result: Result }>) {
  return (
    <div className="space-y-4">
      <Card className="p-5 text-center">
        <p className="font-display text-4xl font-bold">{result.score}/{result.total}</p>
        <p className="mt-1 text-sm">{result.message}</p>
      </Card>
      <ul className="space-y-3">
        {questions.map((q, i) => {
          const f = result.feedback[i];
          if (!f) return null;
          return (
            <li key={q.id}>
              <Card className="space-y-2 p-4">
                <p className="text-sm font-semibold">{q.prompt}</p>
                <p className="flex items-start gap-2 text-sm">
                  {f.right
                    ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span>
                    {f.right ? "You picked " : "The answer is "}
                    <strong>{q.options[f.correct]}</strong>
                    {!f.right && q.options[f.chosen] && <span className="text-muted-foreground"> (you picked {q.options[f.chosen]})</span>}
                  </span>
                </p>
                {f.explanation && <p className="text-sm text-muted-foreground">{f.explanation}</p>}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
