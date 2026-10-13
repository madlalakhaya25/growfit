import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Download, FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthUser } from "@/lib/auth";

const REPORTS = [
  {
    title: "Player Records",
    description:
      "Full player info including medical details, emergency contacts, and consent status for all active players.",
    href: "/api/reports/players",
    filename: "players.csv",
  },
  {
    title: "Attendance Report",
    description:
      "Training session attendance log — who attended, who was unavailable, across all sessions.",
    href: "/api/reports/attendance",
    filename: "attendance.csv",
  },
  {
    title: "Consent & Document Compliance",
    description:
      "Status of all required documents (registration agreement, consent form, code of ethics, medical consent) per player.",
    href: "/api/reports/compliance",
    filename: "compliance.csv",
  },
];

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Export academy data as CSV or open a print-ready PDF.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.href}>
            <CardHeader>
              <CardTitle className="text-base">{r.title}</CardTitle>
              <CardDescription>{r.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button asChild variant="outline" className="flex-1 gap-2">
                <a href={r.href} download={r.filename}>
                  <Download className="size-4" aria-hidden="true" />
                  CSV
                </a>
              </Button>
              <Button asChild className="flex-1 gap-2">
                <a href={`${r.href}?format=pdf`} target="_blank" rel="noopener noreferrer">
                  <FileText className="size-4" aria-hidden="true" />
                  PDF
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
