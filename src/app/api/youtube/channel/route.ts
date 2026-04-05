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
  const days = parseInt(request.nextUrl.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error: dbError } = await supabase
    .from("dash_gestao_youtube_channel_snapshots")
    .select("*")
    .eq("account_id", accountId)
    .gte("collected_at", since.toISOString())
    .order("collected_at", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
