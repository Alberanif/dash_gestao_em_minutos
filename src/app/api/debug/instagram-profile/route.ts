import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * DIAGNOSTIC ENDPOINT - Remove after debugging
 * GET /api/debug/instagram-profile?account_id=XXX&date=2026-01-01
 */
export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();

  const accountId = request.nextUrl.searchParams.get("account_id");
  const date = request.nextUrl.searchParams.get("date");

  if (!accountId || !date) {
    return NextResponse.json(
      { error: "account_id and date parameters required" },
      { status: 400 }
    );
  }

  // Get specific record
  const { data: record, error: recordError } = await supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("*")
    .eq("account_id", accountId)
    .eq("date", date)
    .single();

  if (recordError && recordError.code !== "PGRST116") {
    return NextResponse.json(
      { error: `Record query error: ${recordError.message}` },
      { status: 500 }
    );
  }

  // Get count of records for the account
  const { count, error: countError } = await supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId);

  if (countError) {
    return NextResponse.json(
      { error: `Count query error: ${countError.message}` },
      { status: 500 }
    );
  }

  // Get date range
  const { data: dateRange, error: rangeError } = await supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("date")
    .eq("account_id", accountId)
    .order("date", { ascending: true })
    .limit(1);

  const { data: latestDate, error: latestError } = await supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("date")
    .eq("account_id", accountId)
    .order("date", { ascending: false })
    .limit(1);

  // Get sample records for January
  const { data: januaryData, error: januaryError } = await supabase
    .from("dash_gestao_instagram_profile_daily")
    .select("*")
    .eq("account_id", accountId)
    .gte("date", "2026-01-01")
    .lte("date", "2026-01-31")
    .limit(5);

  return NextResponse.json({
    requestedDate: date,
    recordFound: !!record,
    record: record || null,
    accountStats: {
      totalRecords: count || 0,
      firstDate: dateRange?.[0]?.date,
      lastDate: latestDate?.[0]?.date,
    },
    januarySample: {
      count: januaryData?.length || 0,
      records: januaryData?.slice(0, 3) || [],
    },
    debug: {
      recordError: recordError?.message,
      rangeError: rangeError?.message,
      latestError: latestError?.message,
      januaryError: januaryError?.message,
    },
  });
}
