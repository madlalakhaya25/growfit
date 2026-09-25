import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcademyInfoForm } from "./academy-info-form";
import { AcademyFeaturesForm } from "./academy-features-form";
import { ResetJoinCodeButton } from "./reset-join-code-button";
import { updateAcademyInfo, updateAcademyFeatures } from "@/app/actions/academy";
import { getAcademyFeatures } from "@/lib/features";

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
