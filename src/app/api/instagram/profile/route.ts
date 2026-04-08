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
  
  const startDateStr = request.nextUrl.searchParams.get("start_date");
  const endDateStr = request.nextUrl.searchParams.get("end_date");
  
  let query = supabase
    .from("dash_gestao_instagram_profile_snapshots")
    .select("*")
    .eq("account_id", accountId);

  if (startDateStr) {
    query = query.gte("collected_at", startDateStr);
  } else {
    // Default fallback if no dates provided
    const days = parseInt(request.nextUrl.searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("collected_at", since.toISOString());
  }

  if (endDateStr) {
    query = query.lte("collected_at", endDateStr);
  }

  const { data, error: dbError } = await query.order("collected_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
