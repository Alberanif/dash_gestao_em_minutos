import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const mediaType = request.nextUrl.searchParams.get("type");

  let query = supabase
    .from("dash_gestao_instagram_media")
    .select("*")
    .order("collected_at", { ascending: false });

  if (mediaType) {
    query = query.eq("media_type", mediaType.toUpperCase());
  }

  const { data, error: dbError } = await query.limit(limit);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate: keep only the most recent snapshot per media_id
  const seen = new Set<string>();
  const unique = data.filter((row: { media_id: string }) => {
    if (seen.has(row.media_id)) return false;
    seen.add(row.media_id);
    return true;
  });

  return NextResponse.json(unique);
}
