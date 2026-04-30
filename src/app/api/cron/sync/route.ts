import { NextRequest, NextResponse } from "next/server";
import { validateCronApiKey } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectYouTube } from "@/lib/services/youtube";
import { collectInstagramDaily } from "@/lib/services/instagram";
import { collectHotmart } from "@/lib/services/hotmart";
import { collectMetaAds } from "@/lib/services/meta-ads";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const authError = await validateCronApiKey(request);
  if (authError.error) return authError.error;

  const body = await request.json().catch(() => null);
  const platform = body?.platform;

  if (!platform || !["youtube", "instagram", "hotmart", "meta-ads"].includes(platform)) {
    return NextResponse.json(
      { error: "platform must be youtube, instagram, hotmart or meta-ads" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: accounts, error: accountsError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("platform", platform)
    .eq("is_active", true);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma conta ativa encontrada para esta plataforma" },
      { status: 404 }
    );
  }

  const results: Array<{
    account_id: string;
    account_name: string;
    status: "success" | "error";
    records?: number;
    error?: string;
    analytics_error?: string;
  }> = [];

  for (const account of accounts as Account[]) {
    const startedAt = new Date().toISOString();

    try {
      let records = 0;
      let analyticsError: string | undefined;

      if (account.platform === "youtube") {
        const result = await collectYouTube(account);
        records = result.channelRecords + result.videoRecords;
        analyticsError = result.analyticsError;
      } else if (account.platform === "instagram") {
        const result = await collectInstagramDaily(account);
        records = result.profileRecords + result.mediaRecords;
      } else if (account.platform === "hotmart") {
        const result = await collectHotmart(account);
        records = result.salesRecords;
      } else if (account.platform === "meta-ads") {
        const result = await collectMetaAds(account);
        records = result.dailyRecords + result.campaignDailyRecords;
      }

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: account.platform,
        status: "success",
        records_collected: records,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      results.push({
        account_id: account.id,
        account_name: account.name,
        status: "success",
        records,
        ...(analyticsError && { analytics_error: analyticsError }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: account.platform,
        status: "error",
        error_message: message,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      results.push({
        account_id: account.id,
        account_name: account.name,
        status: "error",
        error: message,
      });
    }
  }

  return NextResponse.json({ results });
}
