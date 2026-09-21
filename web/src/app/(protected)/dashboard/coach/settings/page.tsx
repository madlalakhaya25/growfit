import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { CalendarSubscribeCard } from "@/components/calendar-subscribe-card";

export default async function CoachSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, bio, coaching_role")
    .eq("id", user.id)
    .single();
  // Read separately, not added to the select above: `calendar_token` arrives
  // with migration 037, and a wide SELECT naming a column that doesn't exist
  // fails the whole query (42703) rather than returning the columns that do
  // — which would blank out this page's profile form. Failing soft here just
  // means the card offers to create a link.
  const { data: calendarRow } = await supabase
    .from("profiles")
    .select("calendar_token")
    .eq("id", user.id)
    .maybeSingle();

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
          bio: profile?.bio ?? "",
          coaching_role: profile?.coaching_role ?? "",
        }}
      />
      <CalendarSubscribeCard
        initialToken={
          (calendarRow as { calendar_token?: string | null } | null)?.calendar_token ?? null
        }
      />
      <ChangePasswordForm />
    </div>
  );
}
