import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectYouTube } from "@/lib/services/youtube";
import { collectInstagramDaily } from "@/lib/services/instagram";
import { collectMetaAds } from "@/lib/services/meta-ads";
import { collectHotmart } from "@/lib/services/hotmart";
import type { Account } from "@/types/accounts";

// Janela da coleta Hotmart. "3d" (padrão) captura confirmações tardias de PIX/boleto;
// "24h" serve para a rodada horária. Meta Ads tem janela própria e ignora este valor.
export type SyncWindow = "24h" | "3d";

const WINDOW_MS: Record<SyncWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
};

export interface SyncPlatformOptions {
  window?: SyncWindow;
}

export interface SyncPlatformResult {
  account_id: string;
  account_name: string;
  status: "success" | "error";
  records?: number;
  analytics_error?: string;
  error?: string;
}

/**
 * Coleta uma plataforma (busca as contas ativas) ou uma lista de contas já resolvida.
 */
export async function syncPlatform(
  platformOrAccounts: string | Account[],
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  options: SyncPlatformOptions = {}
): Promise<SyncPlatformResult[]> {
  const window = options.window ?? "3d";
  let accounts: Account[];

  if (typeof platformOrAccounts === "string") {
    const { data, error: accountsError } = await supabase
      .from("dash_gestao_accounts")
      .select("*")
      .eq("platform", platformOrAccounts)
      .eq("is_active", true);

    if (accountsError || !data) {
      return [];
    }
    accounts = data as Account[];
  } else {
    accounts = platformOrAccounts;
  }

  const results: SyncPlatformResult[] = [];

  for (const account of accounts) {
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
      } else if (account.platform === "hotmart") {
        const endDate = new Date();
        const startDate = new Date(
          endDate.getTime() - WINDOW_MS[window]
        );
        const result = await collectHotmart(account, { startDate, endDate });
        records = result.salesRecords;
      } else {
        throw new Error(`Plataforma sem coletor implementado: ${account.platform}`);
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
