import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectYouTube } from "@/lib/services/youtube";
import { collectInstagramDaily } from "@/lib/services/instagram";
import { collectMetaAds } from "@/lib/services/meta-ads";
import type { Account } from "@/types/accounts";

export interface SyncPlatformResult {
  account_id: string;
  account_name: string;
  status: "success" | "error";
  records?: number;
  analytics_error?: string;
  error?: string;
}

export async function syncPlatform(
  platform: string,
  supabase: ReturnType<typeof createSupabaseServiceClient>
): Promise<SyncPlatformResult[]> {
  const { data: accounts, error: accountsError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("platform", platform)
    .eq("is_active", true);

  if (accountsError || !accounts) {
    return [];
  }

  const results: SyncPlatformResult[] = [];

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
      } else if (account.platform === "meta-ads") {
        const result = await collectMetaAds(account);
        records = result.dailyRecords + result.campaignDailyRecords;
      }

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: account.platform,
        status: "success",
        records_collected: records,
        warning_message: analyticsError ?? null,
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

  return results;
}
