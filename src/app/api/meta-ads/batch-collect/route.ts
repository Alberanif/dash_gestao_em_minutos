import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectMetaAds } from "@/lib/services/meta-ads";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const { account_id, start_date, end_date } = body ?? {};

  if (!account_id || !start_date || !end_date) {
    return NextResponse.json(
      { error: "account_id, start_date e end_date são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: account, error: accountError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("id", account_id)
    .eq("platform", "meta-ads")
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Conta meta-ads não encontrada" }, { status: 404 });
  }

  const startedAt = new Date().toISOString();

  try {
    const result = await collectMetaAds(account as Account, start_date, end_date);

    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "meta-ads",
      status: "success",
      records_collected: result.dailyRecords + result.campaignDailyRecords,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "meta-ads",
      status: "error",
      error_message: message,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
