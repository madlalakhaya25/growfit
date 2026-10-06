import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { LESSONS } from "@/lib/lessons-content";
import { LESSON_AREAS, LESSON_DISCLAIMER, findLesson } from "@/lib/lessons";

export default async function LessonPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { slug } = await params;
  const lesson = findLesson(LESSONS, slug);
  if (!lesson) notFound();
  const area = LESSON_AREAS.find((a) => a.key === lesson.area)?.label;

  return (
    <div className="space-y-5">
      <Link href="/dashboard/coach/learn" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> All lessons
      </Link>
      <PageHeader title={lesson.title} eyebrow={area} />
      <div className="space-y-3 text-[15px] leading-relaxed">
        {lesson.body.map((p) => <p key={p}>{p}</p>)}
      </div>
      {lesson.source && <p className="text-xs text-muted-foreground">Source: {lesson.source}</p>}
      <p className="text-xs text-muted-foreground">{LESSON_DISCLAIMER}</p>
    </div>
  );
}
