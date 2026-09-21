import { redirect } from "next/navigation";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddDrillLibraryForm } from "./add-drill-form";
import { EditDrillButton } from "./edit-drill-button";
import { DeleteDrillLibraryButton } from "./delete-drill-button";

const CATEGORY_LABELS: Record<string, string> = {
  warm_up: "Warm Up",
  technical: "Technical",
  tactical: "Tactical",
  physical: "Physical",
  small_sided: "Small Sided",
  cool_down: "Cool Down",
};

const CATEGORY_CHIP: Record<string, string> = {
  warm_up: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  technical: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  tactical: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  physical: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  small_sided: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cool_down: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const DIFFICULTY_CHIP: Record<string, string> = {
  beginner: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  intermediate: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  advanced: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

type Drill = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number | null;
  difficulty: string | null;
  video_url: string | null;
};

export default async function DrillLibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  const { data: drills } = profile?.academy_id
    ? await supabase
        .from("drill_library")
        .select("id, name, description, category, duration_minutes, difficulty, video_url")
        .eq("academy_id", profile.academy_id)
        .order("category")
        .order("name")
    : { data: [] as Drill[] };

  const grouped = ((drills ?? []) as Drill[]).reduce<Record<string, Drill[]>>((acc, d) => {
    const cat = d.category ?? "technical";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  const categories = Object.keys(CATEGORY_LABELS).filter((c) => grouped[c]?.length);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/coach/training" className="text-sm text-muted-foreground hover:text-foreground">
            ← Training
          </Link>
          <h1 className="text-2xl font-bold mt-1">Drill Library</h1>
        </div>
      </div>

      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">No drills in the library yet. Add one below.</p>
      )}

      {categories.map((cat) => (
        <section key={cat} className="space-y-2">
          <h2 className="text-base font-semibold">{CATEGORY_LABELS[cat]}</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {grouped[cat].map((drill: Drill) => (
              <div key={drill.id} className="flex items-start gap-3 px-4 py-3.5">
                <EditDrillButton
                  drill={{
                    id: drill.id,
                    name: drill.name,
                    description: drill.description ?? null,
                    category: drill.category,
                    duration_minutes: drill.duration_minutes ?? null,
                    difficulty: drill.difficulty ?? null,
                    video_url: drill.video_url ?? null,
                  }}
                >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium leading-snug">{drill.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_CHIP[drill.category] ?? ""}`}>
                      {CATEGORY_LABELS[drill.category] ?? drill.category}
                    </span>
                    {drill.difficulty && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${DIFFICULTY_CHIP[drill.difficulty] ?? ""}`}>
                        {drill.difficulty}
                      </span>
                    )}
                    {drill.duration_minutes && (
                      <span className="text-xs text-muted-foreground">{drill.duration_minutes} min</span>
                    )}
                  </div>
                  {drill.description && (
                    <p className="text-sm text-muted-foreground">{drill.description}</p>
                  )}
                  {drill.video_url && (
                    <a
                      href={drill.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                    >
                      <PlayCircle className="size-3.5" aria-hidden="true" />
                      Watch video
                    </a>
                  )}
                </div>
                </EditDrillButton>
                <DeleteDrillLibraryButton id={drill.id} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <AddDrillLibraryForm />
    </div>
  );
}
