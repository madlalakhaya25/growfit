import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";
import { LESSONS } from "@/lib/lessons-content";
import { LESSON_DISCLAIMER, groupLessons } from "@/lib/lessons";

export const metadata = { title: "Learn" };

export default async function LearnPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const groups = groupLessons(LESSONS);

  return (
    <div className="space-y-6">
      <PageHeader title="Learn" eyebrow="Short lessons for coaches" />
      {groups.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No lessons yet. Each one is read and approved by the academy director before it appears here.
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.area.key} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g.area.label}</h2>
            <Card>
              <ListRowGroup className="px-4">
                {g.lessons.map((l) => (
                  <ListRow key={l.slug} title={l.title} subtitle={l.summary} href={`/dashboard/coach/learn/${l.slug}`} />
                ))}
              </ListRowGroup>
            </Card>
          </section>
        ))
      )}
      <p className="text-xs text-muted-foreground">{LESSON_DISCLAIMER}</p>
    </div>
  );
}
