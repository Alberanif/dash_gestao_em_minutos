import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  parseFolderId,
  parseProducts,
  parseViewPeriod,
} from "@/lib/vendas/views-validation";
import {
  VIEW_PRODUCTS_TABLE,
  VIEW_WITH_PRODUCTS_SELECT,
  newBackfillTargets,
  resolveProductsAccount,
  withProducts,
} from "@/lib/vendas/view-products";
import { runBackfill } from "@/lib/vendas/views-sync";
import type { VendasViewProduct, VendasViewRecord } from "@/types/vendas";

export const maxDuration = 60;

type Params = { id: string };

const VIEWS_TABLE = "dash_gestao_vendas_views";
const PATCHABLE = ["name", "folder_id", "products", "view_start_date", "view_end_date"];

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from(VIEWS_TABLE)
    .select(VIEW_WITH_PRODUCTS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });

  return NextResponse.json({ view: withProducts(data) as unknown as VendasViewRecord });
}

// 23514 = CHECK da allowlist; 23503 = FK (produto inexistente); UV002 = mínimo de 1 produto.
function productsErrorStatus(code: string | undefined): number {
  return code === "23514" || code === "23503" || code === "UV002" ? 400 : 500;
}

/**
 * PATCH parcial. `products` (PRD #213) traz a lista COMPLETA de produtos, cada um
 * com a sua allowlist, e SUBSTITUI o conjunto da tabela filha: dá para adicionar
 * e remover produtos/ofertas (mínimo 1 produto, mesma conta da visualização).
 * Adicionar dispara backfill SÓ do que é novo; remover apenas tira da contagem
 * (as vendas continuam em hotmart_sales). product_id/offer_codes soltos no body
 * não existem mais (400).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "body vazio" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  if ("product_id" in input || "offer_codes" in input) {
    return NextResponse.json(
      { error: "Use products: [{ product_id, offer_codes }] no lugar de product_id/offer_codes" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length === 0) {
      return NextResponse.json({ error: "name inválido" }, { status: 400 });
    }
    update.name = input.name.trim();
  }

  if (input.folder_id !== undefined) {
    const folder = parseFolderId(input.folder_id);
    if (!folder.ok) return NextResponse.json({ error: folder.error }, { status: 400 });
    update.folder_id = folder.value;
  }

  if (input.view_start_date !== undefined || input.view_end_date !== undefined) {
    const period = parseViewPeriod(input.view_start_date, input.view_end_date);
    if (!period.ok) return NextResponse.json({ error: period.error }, { status: 400 });
    Object.assign(update, period.value);
  }

  let newProducts: VendasViewProduct[] | null = null;
  if (input.products !== undefined) {
    const products = parseProducts(input.products);
    if (!products.ok) return NextResponse.json({ error: products.error }, { status: 400 });
    newProducts = products.value;
  }

  if (Object.keys(update).length === 0 && newProducts === null) {
    return NextResponse.json(
      { error: `nenhum campo válido para atualizar (${PATCHABLE.join(", ")})` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  // Estado atual: precisamos dos produtos anteriores para saber o que é "novo".
  const { data: current, error: readError } = await supabase
    .from(VIEWS_TABLE)
    .select(VIEW_WITH_PRODUCTS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });

  const before = withProducts(current) as unknown as VendasViewRecord;

  if (newProducts !== null) {
    const account = await resolveProductsAccount(supabase, newProducts, before.account_id);
    if (!account.ok) {
      return NextResponse.json({ error: account.error }, { status: account.status });
    }
  }

  // updated_at é mantido pelo trigger do banco. Só nome/pasta/período vão para a
  // UPDATE; com apenas `products` no body usa-se a linha já lida.
  let row: VendasViewRecord = before;
  if (Object.keys(update).length > 0) {
    const { data: updated, error: dbError } = await supabase
      .from(VIEWS_TABLE)
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (dbError || !updated) {
      if (dbError?.code === "PGRST116") {
        return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });
      }
      // 23514 = CHECK violada (período).
      const status = dbError?.code === "23514" ? 400 : 500;
      return NextResponse.json({ error: dbError?.message ?? "Falha ao atualizar" }, { status });
    }
    row = updated as VendasViewRecord;
  }

  let view: VendasViewRecord = { ...row, products: before.products };

  if (newProducts !== null) {
    // Substitui o conjunto: grava (upsert) ANTES de remover, para a visualização
    // nunca ficar sem produto no meio (o trigger do banco exige >= 1 no commit).
    const { error: upsertError } = await supabase.from(VIEW_PRODUCTS_TABLE).upsert(
      newProducts.map((p) => ({ view_id: id, product_id: p.product_id, offer_codes: p.offer_codes })),
      { onConflict: "view_id,product_id" }
    );
    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: productsErrorStatus(upsertError.code) }
      );
    }

    const kept = newProducts.map((p) => p.product_id);
    const removed = before.products.map((p) => p.product_id).filter((pid) => !kept.includes(pid));
    if (removed.length > 0) {
      const { error: deleteError } = await supabase
        .from(VIEW_PRODUCTS_TABLE)
        .delete()
        .eq("view_id", id)
        .in("product_id", removed);
      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: productsErrorStatus(deleteError.code) }
        );
      }
    }
    view = { ...view, products: newProducts };
  }

  // Só o que é novo — EXCETO se o histórico anterior não está completo: gravar
  // "done" depois de buscar só o produto novo declararia coberto o que nunca foi
  // (backfill_from é único e vale para todos os produtos). Nesse caso refaz tudo.
  const newOnly = newProducts === null ? [] : newBackfillTargets(before.products, newProducts);
  const historyIncomplete = before.backfill_status !== "done";
  const targets =
    newOnly.length > 0 && historyIncomplete && newProducts !== null
      ? newProducts.map((p) => ({ productId: p.product_id, offerCodes: p.offer_codes }))
      : newOnly;
  if (targets.length > 0) {
    const outcome = await runBackfill({
      supabase,
      view,
      targets,
      signal: request.signal,
    });
    view = {
      ...view,
      backfill_status: outcome.status,
      backfill_from: outcome.status === "failed" ? view.backfill_from : outcome.backfillFrom,
    };
  }

  return NextResponse.json({ view });
}

// Remover a visualização NÃO apaga vendas: hotmart_sales é compartilhada e não
// tem FK para a visualização.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from(VIEWS_TABLE)
    .delete()
    .eq("id", id)
    .select("id");

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
