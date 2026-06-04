import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { syncHotmartProducts } from "@/lib/services/hotmart";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const { account_id } = body ?? {};

  if (!account_id) {
    return NextResponse.json(
      { error: "account_id é obrigatório" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: account, error: accountError } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .eq("id", account_id)
    .eq("platform", "hotmart")
    .eq("is_active", true)
    .single();

  if (accountError || !account) {
    return NextResponse.json(
      { error: "Conta Hotmart não encontrada ou inativa" },
      { status: 404 }
    );
  }

  const startedAt = new Date().toISOString();

  try {
    const result = await syncHotmartProducts(account as Account);

    const finishedAt = new Date().toISOString();

    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "hotmart-sync-products",
      status: "success",
      records_collected: result.productsRecords + result.offersRecords,
      started_at: startedAt,
      finished_at: finishedAt,
    });

    return NextResponse.json({
      productsRecords: result.productsRecords,
      offersRecords: result.offersRecords,
      started_at: startedAt,
      finished_at: finishedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const finishedAt = new Date().toISOString();

    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "hotmart-sync-products",
      status: "error",
      error_message: message,
      started_at: startedAt,
      finished_at: finishedAt,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
