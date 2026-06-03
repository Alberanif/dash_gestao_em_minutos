import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectHotmart } from "@/lib/services/hotmart";
import type { Account } from "@/types/accounts";

// Coleta os últimos 60 dias para atualizar reembolsos, estornos e vendas não capturadas.
export async function POST(request: NextRequest) {
  const authError = validateCronSecret(request);
  if (authError) return authError;

  const supabase = createSupabaseServiceClient();

  const { data: accounts, error: accountsError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("platform", "hotmart")
    .eq("is_active", true);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma conta Hotmart ativa encontrada" },
      { status: 404 }
    );
  }

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000);

  const results: Array<{
    account_id: string;
    account_name: string;
    status: "success" | "error";
    records?: number;
    error?: string;
  }> = [];

  for (const account of accounts as Account[]) {
    const startedAt = new Date().toISOString();

    try {
      const result = await collectHotmart(account, { startDate, endDate });

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: "hotmart",
        status: "success",
        records_collected: result.salesRecords,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      results.push({
        account_id: account.id,
        account_name: account.name,
        status: "success",
        records: result.salesRecords,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: "hotmart",
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
