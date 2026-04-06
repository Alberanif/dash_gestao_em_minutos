import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { collectYouTube } from "@/lib/services/youtube";
import { collectInstagram } from "@/lib/services/instagram";
import { collectHotmart } from "@/lib/services/hotmart";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseServiceClient();

  // Busca todas as contas ativas
  const { data: accounts, error: accountsError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("is_active", true);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  const results: Array<{
    account_id: string;
    account_name: string;
    platform: string;
    status: "success" | "error";
    records?: number;
    error?: string;
  }> = [];

  for (const account of (accounts as Account[])) {
    const startedAt = new Date().toISOString();

    try {
      let records = 0;

      if (account.platform === "youtube") {
        const result = await collectYouTube(account);
        records = result.channelRecords + result.videoRecords;
      } else if (account.platform === "instagram") {
        const result = await collectInstagram(account);
        records = result.profileRecords + result.mediaRecords;
      } else if (account.platform === "hotmart") {
        const result = await collectHotmart(account);
        records = result.salesRecords;
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
        platform: account.platform,
        status: "success",
        records,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

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
        platform: account.platform,
        status: "error",
        error: message,
      });
    }
  }

  return NextResponse.json({ results });
}
