import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcademyInfoForm } from "./academy-info-form";
import { AcademyFeaturesForm } from "./academy-features-form";
import { ResetJoinCodeButton } from "./reset-join-code-button";
import { updateAcademyInfo, updateAcademyFeatures } from "@/app/actions/academy";
import { getAcademyFeatures } from "@/lib/features";
import { todayIso } from "@/lib/time";
import { TermsCard } from "./terms-card";
import { overlappingTerms } from "@/lib/school-terms";

export default async function AcademySettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id || profile.role !== "admin") redirect("/dashboard/admin");

  const { data: academy } = await supabase
    .from("academies")
    .select("id, name, province, join_code")
    .eq("id", profile.academy_id)
    .single();

  if (!academy) redirect("/dashboard/admin");

  const features = await getAcademyFeatures(supabase, academy.id);

  // Absent until migration 053 is run: the card then just offers setup and
  // the page keeps working.
  const { data: termRows } = await supabase
    .from("academy_terms")
    .select("id, name, starts_on, ends_on")
    .eq("academy_id", academy.id)
    .order("starts_on");
  const terms = (termRows ?? []) as { id: string; name: string; starts_on: string; ends_on: string }[];
  const overlaps = overlappingTerms(terms);
  const today = todayIso();
  const year = Number(today.slice(0, 4));

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Academy Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your club information and member join code.
        </p>
      </div>

      {/* Academy info card */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Club information</h2>
          <p className="text-sm text-muted-foreground">Update your club name and location.</p>
        </div>
        <AcademyInfoForm
          defaultName={academy.name ?? ""}
          defaultProvince={academy.province ?? ""}
          action={updateAcademyInfo}
        />
      </section>

      {/* Join code card */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Member join code</h2>
          <p className="text-sm text-muted-foreground">
            Share this code with coaches, players, and parents when they register.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3">
          <div className="rounded-lg border border-border bg-muted px-6 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Join code</p>
            <p className="font-mono text-4xl font-extrabold tracking-widest text-primary">
              {academy.join_code ?? "——"}
            </p>
          </div>
          <ResetJoinCodeButton />
        </div>
      </section>

      {/* School terms card */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">School terms</h2>
          <p className="text-sm text-muted-foreground">
            The dates each term review is measured against.
          </p>
        </div>
        {overlaps.length > 0 && (
          <p role="alert" className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Some terms overlap: {overlaps.map((t) => t.name).join(", ")}.
          </p>
        )}
        <TermsCard terms={terms} year={year} />
      </section>

      {/* Feature toggles card */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Features</h2>
          <p className="text-sm text-muted-foreground">
            Turn optional features on or off for everyone at your academy.
          </p>
        </div>
        <AcademyFeaturesForm action={updateAcademyFeatures} initial={features} />
      </section>
    </div>
  );
}
