import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_video_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .order("collected_at", { ascending: false })
    .limit(limit);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate by video_id (keep most recent snapshot per video)
  const seen = new Set<string>();
  const deduplicated = (data || []).filter((row) => {
    if (seen.has(row.video_id)) return false;
    seen.add(row.video_id);
    return true;
  });

  return NextResponse.json(deduplicated);
}
