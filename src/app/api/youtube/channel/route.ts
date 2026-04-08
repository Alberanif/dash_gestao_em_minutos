// src/app/api/youtube/channel/route.ts
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
    .from("dash_gestao_youtube_channel_daily")
    .select("*")
    .eq("account_id", accountId)
    .order("date", { ascending: true });

  if (startDateStr) query = query.gte("date", startDateStr.slice(0, 10));
  if (endDateStr) query = query.lte("date", endDateStr.slice(0, 10));

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
