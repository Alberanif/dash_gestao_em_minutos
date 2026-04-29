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

  const startDateStr = request.nextUrl.searchParams.get("start_date");
  const endDateStr = request.nextUrl.searchParams.get("end_date");

  let query = supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("*, date::text as collected_at")
    .eq("account_id", accountId);

  if (startDateStr) {
    query = query.gte("date", startDateStr.split("T")[0]);
  } else {
    // Default fallback if no dates provided
    const days = parseInt(request.nextUrl.searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("date", since.toISOString().split("T")[0]);
  }

  if (endDateStr) {
    query = query.lte("date", endDateStr.split("T")[0]);
  }

  const { data, error: dbError } = await query.order("date", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
