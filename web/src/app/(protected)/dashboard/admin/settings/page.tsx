import { redirect } from "next/navigation";
import { PoweredByGrowfit } from "@/components/powered-by-growfit";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and account security.</p>
      </div>
      <ProfileForm
        defaultValues={{
          full_name: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
        }}
      />
      <ChangePasswordForm />
      <PoweredByGrowfit />
    </div>
  );
}
