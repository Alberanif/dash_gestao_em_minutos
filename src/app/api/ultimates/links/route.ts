import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesManualLinkRecord } from "@/types/ultimates";

type PostBody = {
  cycleId?: string;
  buyerId?: string;
  transactionCode?: string;
};

type DeleteBody = {
  cycleId?: string;
  transactionCode?: string;
};

// Vínculo manual comprador -> venda Hotmart (RF-9/RF-11, PRD issue #114).
// POST resolve a renovação com email diferente do cadastrado na base;
// DELETE desfaz o vínculo. Ambos exigem papel gestor e auditam quem agiu
// (linked_by na escrita, log no unlink — não há tabela de histórico).
export async function POST(request: NextRequest) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const body = (await request.json().catch(() => null)) as PostBody | null;
  const { cycleId, buyerId, transactionCode } = body ?? {};

  if (!cycleId || !buyerId || !transactionCode) {
    return NextResponse.json(
      { error: "cycleId, buyerId e transactionCode são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id, status")
    .eq("id", cycleId)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  if (cycle.status === "encerrado") {
    return NextResponse.json({ error: "Ciclo encerrado" }, { status: 409 });
  }

  // O conjunto de produtos vive em dash_gestao_ultimates_cycle_products desde a
  // migration 057 — a venda precisa ser de ALGUM deles.
  const { data: cycleProducts, error: cycleProductsError } = await supabase
    .from("dash_gestao_ultimates_cycle_products")
    .select("product_id")
    .eq("cycle_id", cycleId);

  if (cycleProductsError) {
    return NextResponse.json({ error: cycleProductsError.message }, { status: 500 });
  }

  const cycleProductIds = new Set(
    ((cycleProducts ?? []) as { product_id: string }[]).map((row) => row.product_id)
  );

  const { data: buyer, error: buyerError } = await supabase
    .from("dash_gestao_ultimates_buyers")
    .select("id, cycle_id")
    .eq("id", buyerId)
    .single();

  if (buyerError || !buyer || buyer.cycle_id !== cycleId) {
    return NextResponse.json({ error: "Comprador não encontrado" }, { status: 404 });
  }

  const { data: sale, error: saleError } = await supabase
    .from("dash_gestao_hotmart_sales")
    .select("transaction_code, product_id, offer_code")
    .eq("transaction_code", transactionCode)
    .single();

  if (saleError || !sale || !cycleProductIds.has(sale.product_id)) {
    return NextResponse.json(
      { error: "Transação não encontrada para os produtos deste ciclo" },
      { status: 400 }
    );
  }

  // Oferta excluída vence o vínculo manual (PRD de 2026-07-30, decisão 4): as
  // RPCs descartam a venda antes de olhar para manual_links, então o vínculo
  // nasceria sem efeito algum. Recusar aqui evita um vínculo que o gestor
  // acharia ter resolvido a classificação.
  if (sale.offer_code) {
    const { data: excludedOffer } = await supabase
      .from("dash_gestao_ultimates_excluded_offers")
      .select("id")
      .eq("cycle_id", cycleId)
      .eq("offer_code", sale.offer_code)
      .maybeSingle();

    if (excludedOffer) {
      return NextResponse.json(
        { error: "Transação pertence a uma oferta excluída deste ciclo" },
        { status: 400 }
      );
    }
  }

  const { data: existingLink } = await supabase
    .from("dash_gestao_ultimates_manual_links")
    .select("id")
    .eq("transaction_code", transactionCode)
    .single();

  if (existingLink) {
    return NextResponse.json({ error: "Transação já vinculada" }, { status: 409 });
  }

  const { data: link, error: insertError } = await supabase
    .from("dash_gestao_ultimates_manual_links")
    .insert({
      cycle_id: cycleId,
      buyer_id: buyerId,
      transaction_code: transactionCode,
      linked_by: userId,
    })
    .select()
    .single();

  if (insertError || !link) {
    return NextResponse.json(
      { error: insertError?.message ?? "Falha ao criar vínculo" },
      { status: 500 }
    );
  }

  return NextResponse.json({ link: link as UltimatesManualLinkRecord }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const body = (await request.json().catch(() => null)) as DeleteBody | null;
  const { cycleId, transactionCode } = body ?? {};

  if (!cycleId || !transactionCode) {
    return NextResponse.json(
      { error: "cycleId e transactionCode são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id, status")
    .eq("id", cycleId)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  if (cycle.status === "encerrado") {
    return NextResponse.json({ error: "Ciclo encerrado" }, { status: 409 });
  }

  const { data: link, error: linkError } = await supabase
    .from("dash_gestao_ultimates_manual_links")
    .select("id")
    .eq("cycle_id", cycleId)
    .eq("transaction_code", transactionCode)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("dash_gestao_ultimates_manual_links")
    .delete()
    .eq("id", link.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Trilha mínima de auditoria do unlink — não há tabela de histórico no
  // schema (dash_gestao_ultimates_manual_links só registra vínculos ativos).
  console.log(
    `[ultimates:links] unlink transaction_code=${transactionCode} cycle_id=${cycleId} by user_id=${userId}`
  );

  return new NextResponse(null, { status: 204 });
}
