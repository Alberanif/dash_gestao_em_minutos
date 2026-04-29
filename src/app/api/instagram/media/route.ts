import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();

  let accountId = request.nextUrl.searchParams.get("account_id");

  // If no account_id provided, get the first Instagram account
  if (!accountId) {
    const { data: accounts, error: accountError } = await supabase
      .from("dash_gestao_accounts")
      .select("id")
      .eq("platform", "instagram")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (accountError || !accounts) {
      return NextResponse.json({ error: "Nenhuma conta Instagram encontrada" }, { status: 404 });
    }

    accountId = accounts.id;
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const type = request.nextUrl.searchParams.get("type");

  let query = supabase
    .from("dash_gestao_instagram_media_daily")
    .select("*")
    .eq("account_id", accountId)
    .order("last_collected_at", { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq("media_type", type);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Deduplicate by media_id (keep most recent record per media)
  const seen = new Set<string>();
  const deduplicated = (data || []).filter((row) => {
    if (seen.has(row.media_id)) return false;
    seen.add(row.media_id);
    return true;
  });

  return NextResponse.json(deduplicated);
}
