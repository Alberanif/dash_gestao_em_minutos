import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_videos")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate: keep only the most recent snapshot per video_id
  const seen = new Set<string>();
  const unique = data.filter((row: { video_id: string }) => {
    if (seen.has(row.video_id)) return false;
    seen.add(row.video_id);
    return true;
  });

  return NextResponse.json(unique);
}
