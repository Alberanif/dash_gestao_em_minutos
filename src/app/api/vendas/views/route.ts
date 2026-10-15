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
  resolveProductsAccount,
  withProducts,
} from "@/lib/vendas/view-products";
import { runBackfill } from "@/lib/vendas/views-sync";
import type { VendasViewRecord } from "@/types/vendas";

// Backfill síncrono no POST: espera a Hotmart dentro do orçamento (BACKFILL_BUDGET_MS).
export const maxDuration = 60;

const VIEWS_TABLE = "dash_gestao_vendas_views";

/**
 * Visualizações do Relatório de Vendas (PRD #185, fatia 2/4; multi-produto PRD
 * #213). GET: gestor e analista; cada visualização vem com `products`. POST: só
 * gestor, com `products: [{ product_id, offer_codes }]`. O escopo de leitura é o
 * mesmo de a rota antiga de listagem (todas as visualizações; o app tem uma
 * única conta).
 */
export async function GET() {
  const { error, role } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();

  const { data: views, error: viewsError } = await supabase
    .from(VIEWS_TABLE)
    .select(VIEW_WITH_PRODUCTS_SELECT)
    .order("created_at", { ascending: false });

  if (viewsError) {
    return NextResponse.json({ error: viewsError.message }, { status: 500 });
  }

  const rows = ((views ?? []) as unknown as object[]).map(
    (row) => withProducts(row) as unknown as VendasViewRecord
  );

  // Aviso do RF-9: ciclos ativos que a migration não converteu. Só o gestor age
  // sobre isso, então o analista nem paga a query.
  let unmigrated: { id: string; name: string }[] = [];

  if (role === "gestor") {
    const { data: cycles, error: cyclesError } = await supabase
      .from("dash_gestao_vendas_cycles")
      .select("id, name")
      .eq("status", "ativo");

    if (cyclesError) {
      return NextResponse.json({ error: cyclesError.message }, { status: 500 });
    }

    const migrated = new Set(
      rows
        .map((view) => view.migrated_from_cycle_id)
        .filter((id): id is string => typeof id === "string")
    );
    unmigrated = ((cycles ?? []) as { id: string; name: string }[])
      .filter((cycle) => !migrated.has(cycle.id))
      .map((cycle) => ({ id: cycle.id, name: cycle.name }));
  }

  return NextResponse.json({ views: rows, unmigrated_cycles: unmigrated });
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  if (typeof input.name !== "string" || input.name.trim().length === 0) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  const products = parseProducts(input.products);
  if (!products.ok) return NextResponse.json({ error: products.error }, { status: 400 });

  let folderId: string | null = null;
  if (input.folder_id !== undefined) {
    const folder = parseFolderId(input.folder_id);
    if (!folder.ok) return NextResponse.json({ error: folder.error }, { status: 400 });
    folderId = folder.value;
  }

  let period: { view_start_date: string | null; view_end_date: string | null } = {
    view_start_date: null,
    view_end_date: null,
  };
  if (input.view_start_date !== undefined || input.view_end_date !== undefined) {
    const parsed = parseViewPeriod(input.view_start_date, input.view_end_date);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    period = parsed.value;
  }

  const supabase = createSupabaseServiceClient();

  const account = await resolveProductsAccount(supabase, products.value);
  if (!account.ok) {
    return NextResponse.json({ error: account.error }, { status: account.status });
  }

  const { data: created, error: insertError } = await supabase
    .from(VIEWS_TABLE)
    .insert({
      name: input.name.trim(),
      account_id: account.accountId,
      folder_id: folderId,
      ...period,
      created_by: userId,
    })
    .select()
    .single();

  if (insertError || !created) {
    // 23514 = CHECK violada (período): entrada inválida, não falha nossa.
    const status = insertError?.code === "23514" ? 400 : 500;
    return NextResponse.json({ error: insertError?.message ?? "Falha ao criar" }, { status });
  }

  const createdView = created as VendasViewRecord;

  // Sem transação no client: se os produtos não gravarem, desfaz a visualização
  // (cascade) para não deixar uma visualização sem produto.
  const { error: productsError } = await supabase.from(VIEW_PRODUCTS_TABLE).insert(
    products.value.map((p) => ({
      view_id: createdView.id,
      product_id: p.product_id,
      offer_codes: p.offer_codes,
    }))
  );
  if (productsError) {
    await supabase.from(VIEWS_TABLE).delete().eq("id", createdView.id);
    // 23514 = CHECK da allowlist; 23503 = FK (produto inexistente).
    const status = productsError.code === "23514" || productsError.code === "23503" ? 400 : 500;
    return NextResponse.json({ error: productsError.message }, { status });
  }

  // Backfill síncrono. Nunca derruba a criação: o resultado fica em
  // backfill_status/backfill_from do registro devolvido.
  const outcome = await runBackfill({
    supabase,
    view: createdView,
    targets: products.value.map((p) => ({ productId: p.product_id, offerCodes: p.offer_codes })),
    signal: request.signal,
  });

  const view: VendasViewRecord = {
    ...createdView,
    products: products.value,
    backfill_status: outcome.status,
    backfill_from: outcome.status === "failed" ? null : outcome.backfillFrom,
  };

  return NextResponse.json({ view }, { status: 201 });
}
