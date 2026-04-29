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

  const startDateOnly = startDateStr ? startDateStr.split("T")[0] : null;
  const endDateOnly = endDateStr ? endDateStr.split("T")[0] : null;

  let query = supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("*")
    .eq("account_id", accountId);

  if (startDateOnly) {
    query = query.gte("date", startDateOnly);
  } else {
    // Default fallback if no dates provided
    const days = parseInt(request.nextUrl.searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("date", since.toISOString().split("T")[0]);
  }

  if (endDateOnly) {
    query = query.lte("date", endDateOnly);
  }

  console.log("[Instagram Profile API] Query parameters:", {
    accountId,
    startDateOnly,
    endDateOnly,
  });

  const { data, error: dbError } = await query.order("date", { ascending: true });

  if (dbError) {
    console.error("[Instagram Profile API] Database error:", {
      error: dbError.message,
      accountId,
      startDateStr,
      endDateStr,
    });
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  // Transform date field to collected_at for backward compatibility
  const transformed = (data || []).map((row: any) => ({
    ...row,
    collected_at: row.date,
  }));

  console.log("[Instagram Profile API] Returning data:", {
    accountId,
    startDate: startDateStr,
    endDate: endDateStr,
    recordCount: transformed.length,
    hasData: transformed.length > 0,
  });

  return NextResponse.json(transformed);
}
