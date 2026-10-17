import type { SupabaseClient } from "@supabase/supabase-js";
import { INDICADORES_LOCK_NAME } from "@/lib/cron/lock";
import { isMonitoredAccount, type AccountCronStatus } from "@/lib/indicadores/cron-freshness";

/**
 * Leitura do banco que alimenta `computeRefreshStatus`, compartilhada pelo
 * GET /api/indicadores/refresh-status e pelo POST /api/indicadores/refresh
 * (a regra de `can_refresh` é uma só).
 */
export interface RefreshInputs {
  running: boolean;
  lastFinishedAt: string | null;
  accounts: AccountCronStatus[];
}

export async function loadRefreshInputs(
  supabase: SupabaseClient,
  now: Date,
): Promise<{ inputs: RefreshInputs; error?: undefined } | { error: string; inputs?: undefined }> {
  const { data: accounts, error: accError } = await supabase
    .from("dash_gestao_accounts")
    .select("id, name, platform, is_active")
    .in("platform", ["hotmart", "meta-ads"])
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (accError) return { error: accError.message };
  const monitored = (accounts ?? []).filter(isMonitoredAccount);

  const { data: lock, error: lockError } = await supabase
    .from("dash_gestao_cron_locks")
    .select("expires_at")
    .eq("name", INDICADORES_LOCK_NAME)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (lockError) return { error: lockError.message };

  const ids = monitored.map((a) => a.id);

  const statuses: AccountCronStatus[] = await Promise.all(
    monitored.map(async (acc) => {
      const latest = (status: "success" | "error") =>
        supabase
          .from("dash_gestao_cron_logs")
          .select("started_at, finished_at, error_message")
          .eq("account_id", acc.id)
          .eq("status", status)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      const [ok, fail] = await Promise.all([latest("success"), latest("error")]);
      return {
        account_id: acc.id,
        name: acc.name,
        platform: acc.platform,
        last_success_at: ok.data ? (ok.data.finished_at ?? ok.data.started_at) : null,
        last_error_at: fail.data ? (fail.data.finished_at ?? fail.data.started_at) : null,
        last_error_message: fail.data?.error_message ?? null,
      };
    }),
  );

  let lastFinishedAt: string | null = null;
  if (ids.length > 0) {
    const { data: last, error: lastError } = await supabase
      .from("dash_gestao_cron_logs")
      .select("finished_at")
      .in("account_id", ids)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) return { error: lastError.message };
    lastFinishedAt = last?.finished_at ?? null;
  }

  return { inputs: { running: lock !== null, lastFinishedAt, accounts: statuses } };
}
