import { NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { INDICADORES_LOCK_NAME } from "@/lib/cron/lock";
import { isMonitoredAccount, type AccountCronStatus } from "@/lib/indicadores/cron-freshness";
import { computeRefreshStatus } from "@/lib/indicadores/refresh-status";

/**
 * GET /api/indicadores/refresh-status
 * O que o botão "Atualizar Agora" precisa: coleta rodando (lock `indicadores`
 * não vencido), fim da última coleta, erros vigentes por conta e se pode
 * disparar. Mesmas roles do layout de /indicadores (gestor e analista).
 */
export async function GET() {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const now = new Date();

  const { data: accounts, error: accError } = await supabase
    .from("dash_gestao_accounts")
    .select("id, name, platform, is_active")
    .in("platform", ["hotmart", "meta-ads"])
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (accError) {
    return NextResponse.json({ error: accError.message }, { status: 500 });
  }
  const monitored = (accounts ?? []).filter(isMonitoredAccount);

  const { data: lock, error: lockError } = await supabase
    .from("dash_gestao_cron_locks")
    .select("expires_at")
    .eq("name", INDICADORES_LOCK_NAME)
    .gt("expires_at", now.toISOString())
    .maybeSingle();
  if (lockError) {
    return NextResponse.json({ error: lockError.message }, { status: 500 });
  }

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
    if (lastError) {
      return NextResponse.json({ error: lastError.message }, { status: 500 });
    }
    lastFinishedAt = last?.finished_at ?? null;
  }

  return NextResponse.json(
    computeRefreshStatus({ running: lock !== null, lastFinishedAt, accounts: statuses, now }),
  );
}
