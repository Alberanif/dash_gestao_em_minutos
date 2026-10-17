import { NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isMonitoredAccount, type AccountCronStatus } from "@/lib/indicadores/cron-freshness";

/**
 * GET /api/indicadores/cron-status
 * Estado da coleta automática por conta ativa de Hotmart e Meta Ads, lido de
 * dash_gestao_cron_logs. Conta ativa sem log aparece com tudo null.
 */
export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();

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

  const result: AccountCronStatus[] = await Promise.all(
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

  return NextResponse.json({ accounts: result });
}
