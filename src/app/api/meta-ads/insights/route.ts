import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const account_id = searchParams.get("account_id");
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!account_id) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("dash_gestao_meta_ads_daily")
    .select("*")
    .eq("account_id", account_id)
    .order("date", { ascending: true });

  if (start_date) query = query.gte("date", start_date);
  if (end_date) query = query.lte("date", end_date);

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
