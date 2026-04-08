import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { collectHotmart } from "@/lib/services/hotmart";
import type { Account } from "@/types/accounts";

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  const { account_id, start_date, end_date } = body ?? {};

  if (!account_id || !start_date || !end_date) {
    return NextResponse.json(
      { error: "account_id, start_date e end_date são obrigatórios" },
      { status: 400 }
    );
  }

  const startDate = new Date(`${start_date}T00:00:00`);
  const endDate = new Date(`${end_date}T23:59:59`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: "Datas inválidas. Use o formato YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (startDate > endDate) {
    return NextResponse.json(
      { error: "A data de início não pode ser posterior à data de fim" },
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
    const result = await collectHotmart(account as Account, { startDate, endDate });

    const finishedAt = new Date().toISOString();

    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "hotmart_batch",
      status: "success",
      records_collected: result.salesRecords,
      started_at: startedAt,
      finished_at: finishedAt,
    });

    return NextResponse.json({
      salesRecords: result.salesRecords,
      started_at: startedAt,
      finished_at: finishedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const finishedAt = new Date().toISOString();

    await supabase.from("dash_gestao_cron_logs").insert({
      account_id,
      job_name: "hotmart_batch",
      status: "error",
      error_message: message,
      started_at: startedAt,
      finished_at: finishedAt,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
