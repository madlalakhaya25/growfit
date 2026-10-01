import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MilestoneTemplateData } from "@/app/actions/development";
import type { MilestoneCategory } from "@/lib/development-categories";
import { PageHeader } from "@/components/ui/page-header";
import { MilestoneManager } from "./milestone-form";

type TemplateRow = MilestoneTemplateData & { id: string };

export default async function AdminDevelopmentPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id || profile.role !== "admin") redirect("/dashboard/admin");

  const { data: rawTemplates } = await supabase
    .from("development_milestone_templates")
    .select("id, title, description, category, position, age_group, sort_order")
    .eq("academy_id", profile.academy_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const templates: TemplateRow[] = (rawTemplates ?? []).map((t: {
    id: string;
    title: string;
    description: string | null;
    category: MilestoneCategory;
    position: string | null;
    age_group: string | null;
    sort_order: number;
  }) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    category: t.category,
    position: t.position as MilestoneTemplateData["position"],
    age_group: t.age_group,
    sort_order: t.sort_order,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Development Pathways"
        description="Manage milestone templates that coaches use to track player development."
      />
      <MilestoneManager academyId={profile.academy_id} templates={templates} />
    </div>
  );
}
