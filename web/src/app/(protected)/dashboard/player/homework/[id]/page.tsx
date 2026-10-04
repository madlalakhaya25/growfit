import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMyHomework } from "@/app/actions/homework";
import { PlayViewer, type PlayData } from "@/components/tactics/play-viewer";
import { FilmViewer, type FilmViewerData } from "@/components/tactics/film-viewer";
import { HomeworkQuiz } from "@/components/homework/homework-quiz";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { formatWeekdayDayMonth } from "@/lib/time";

function BackLink() {
  return (
    <Link href="/dashboard/player/homework" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" />
      All homework
    </Link>
  );
}

function PlayBlock({ data }: Readonly<{ data: unknown }>) {
  if ((data as { surface?: string } | null)?.surface === "film") {
    return <FilmViewer data={data as FilmViewerData} />;
  }
  return (
    <>
      <PlayViewer data={data as PlayData} />
      <p className="text-center text-xs text-muted-foreground">
        Press play, or go step by step. Watch where you should be at each moment.
      </p>
    </>
  );
}

export default async function PlayerHomeworkDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const { available, homework, error } = await getMyHomework(id);

  if (!available || !homework) {
    return (
      <div className="space-y-4">
        <BackLink />
        <PageHeader title="Homework" />
        <p className="text-sm text-muted-foreground">
          {available ? (error ?? "We couldn't find that homework.") : "Homework isn't set up at your academy yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BackLink />
      <PageHeader title={homework.title} description={`Due ${formatWeekdayDayMonth(homework.dueDate)}`} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">1. Watch the play</h2>
        {homework.play ? (
          <>
            {homework.play.notes && (
              <Card className="p-4"><p className="text-sm leading-relaxed text-muted-foreground">{homework.play.notes}</p></Card>
            )}
            <PlayBlock data={homework.play.data} />
          </>
        ) : (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">This play isn&apos;t available any more. You can still answer the questions.</p>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{homework.result ? "2. How you did" : "2. Answer the questions"}</h2>
        <HomeworkQuiz homeworkId={homework.id} questions={homework.questions} initialResult={homework.result} />
      </section>
    </div>
  );
}
