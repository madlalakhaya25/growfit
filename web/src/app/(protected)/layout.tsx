import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  // A player who signed up without a club code is allowed through to the
  // "waiting to be added" state; every other case still needs an academy link.
  if (!profile?.role) redirect("/auth/role");
  if (!profile.academy_id && profile.role !== "player") redirect("/auth/role");

  return (
    <DashboardShell profile={profile}>
      {children}
    </DashboardShell>
  );
}
