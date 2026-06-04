import { NextRequest, NextResponse } from "next/server";
import { validateCronSecret } from "@/lib/utils/cron-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { syncHotmartProducts } from "@/lib/services/hotmart";
import type { Account } from "@/types/accounts";

export async function GET(request: NextRequest) {
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

  const results: Array<{
    account_id: string;
    account_name: string;
    status: "success" | "error";
    productsRecords?: number;
    offersRecords?: number;
    error?: string;
  }> = [];

  for (const account of accounts as Account[]) {
    const startedAt = new Date().toISOString();

    try {
      const result = await syncHotmartProducts(account);

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: "hotmart-sync-products",
        status: "success",
        records_collected: result.productsRecords + result.offersRecords,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });

      results.push({
        account_id: account.id,
        account_name: account.name,
        status: "success",
        productsRecords: result.productsRecords,
        offersRecords: result.offersRecords,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";

      await supabase.from("dash_gestao_cron_logs").insert({
        account_id: account.id,
        job_name: "hotmart-sync-products",
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
