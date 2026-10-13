import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const exclude = searchParams.get("exclude")?.split(",").filter(Boolean) ?? [];

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  if (!profile?.academy_id) return NextResponse.json({ players: [] });

  let query = supabase
    .from("players")
    .select("id, full_name, position, date_of_birth, preferred_foot")
    .eq("academy_id", profile.academy_id)
    .eq("active", true)
    .order("full_name")
    .limit(20);

  if (q) query = query.ilike("full_name", `%${q}%`);
  if (exclude.length) query = query.not("id", "in", `(${exclude.join(",")})`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ players: data ?? [] });
}
