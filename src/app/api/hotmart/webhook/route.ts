import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const RELEVANT_EVENTS = new Set([
  "PURCHASE_APPROVED",
  "PURCHASE_COMPLETE",
  "PURCHASE_CANCELLED",
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_EXPIRED",
]);

export async function POST(request: NextRequest) {
  const expectedToken = process.env.HOTMART_WEBHOOK_TOKEN;
  const hottok = request.headers.get("x-hotmart-hottok");
  if (!expectedToken || !hottok || hottok !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = (body as { event?: string }).event;
  if (!event || !RELEVANT_EVENTS.has(event)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const purchase = (body as { data?: { purchase?: { transaction?: string; status?: string } } })
    .data?.purchase;

  const transactionCode = purchase?.transaction;
  const status = purchase?.status;

  if (!transactionCode || !status) {
    return NextResponse.json({ error: "Missing transaction or status" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from("dash_gestao_hotmart_sales")
    .update({ status, collected_at: new Date().toISOString() })
    .eq("transaction_code", transactionCode);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Passo aditivo Dash Ultimates (RF-6, critério 7) ───────────────────────────
  // Espelha a venda em tempo real APENAS para produtos monitorados por um ciclo
  // ativo. À PROVA DE FALHA por design: todo o bloco vive em seu próprio try/catch;
  // qualquer erro (payload malformado, banco indisponível, etc.) é engolido e
  // logado, e a resposta HTTP acima permanece EXATAMENTE a mesma em todos os
  // cenários — nenhuma linha do fluxo existente é alterada por este passo.
  try {
    const ultimatesData = (
      body as {
        data?: {
          product?: { id?: number | string; name?: string };
          // name/checkout_phone: identidade do comprador (PRD #146). O webhook
          // é a ÚNICA fonte de telefone — a API sales/history não o devolve.
          buyer?: { email?: string; name?: string; checkout_phone?: string };
          purchase?: {
            price?: { value?: number };
            order_date?: number | string;
            approved_date?: number | string;
          };
        };
      }
    ).data;

    const rawProductId = ultimatesData?.product?.id;
    if (rawProductId != null && rawProductId !== "") {
      // product_id na tabela é text; o payload traz número — normalize com String().
      const productId = String(rawProductId);

      const { data: cycles, error: cyclesError } = await supabase
        .from("dash_gestao_ultimates_cycles")
        .select("account_id")
        .eq("product_id", productId)
        .eq("status", "ativo")
        .limit(1);

      if (cyclesError) throw cyclesError;

      const cycle = cycles?.[0];
      if (cycle) {
        // Datas do payload v2 podem vir como epoch millis; new Date() aceita millis
        // ou ISO. Guarda contra valores ausentes/inválidos.
        const toIsoDate = (value: number | string | undefined | null): string | null => {
          if (value == null || value === "") return null;
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
        };

        // Identidade do comprador (PRD #146). CHAVE OMITIDA quando o campo não
        // vem — nunca enviada como null. O upsert do PostgREST só atualiza as
        // colunas PRESENTES no payload: enviar null aqui faria um evento de
        // estorno (que não repete os dados do comprador) apagar o nome que o
        // cron já gravou para a mesma transação.
        const buyerName = ultimatesData?.buyer?.name?.trim() || null;
        const buyerPhone = ultimatesData?.buyer?.checkout_phone?.trim() || null;

        const { error: upsertError } = await supabase
          .from("dash_gestao_hotmart_sales")
          .upsert(
            {
              account_id: cycle.account_id,
              transaction_code: transactionCode,
              product_id: productId,
              product_name: ultimatesData?.product?.name ?? null,
              status,
              // Preço PROVISÓRIO por design: o payload do webhook traz price.value,
              // que inclui juros de parcelamento e pode divergir do cálculo canônico
              // (hotmart_fee.base - total - fixed) feito em src/lib/services/hotmart.ts.
              // O cron diário e o "Atualizar agora" reprocessam a mesma
              // transaction_code e sobrescrevem com o valor canônico (upsert
              // idempotente via onConflict: transaction_code).
              price: ultimatesData?.purchase?.price?.value ?? null,
              buyer_email: ultimatesData?.buyer?.email ?? null,
              ...(buyerName ? { buyer_name: buyerName } : {}),
              ...(buyerPhone ? { buyer_phone: buyerPhone } : {}),
              purchase_date: toIsoDate(ultimatesData?.purchase?.order_date),
              approved_date: toIsoDate(ultimatesData?.purchase?.approved_date),
              collected_at: new Date().toISOString(),
            },
            { onConflict: "transaction_code" }
          );

        if (upsertError) throw upsertError;
      }
    }
  } catch (ultimatesError) {
    // À prova de falha: nunca propaga. A resposta 200 abaixo é preservada.
    console.error("[hotmart-webhook][ultimates] passo aditivo falhou:", ultimatesError);
  }

  return NextResponse.json({ ok: true });
}
