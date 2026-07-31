import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesCycleRecord, UltimatesCycleProductRef } from "@/types/ultimates";

// Ciclo com o conjunto de produtos anexado. O join é manual (duas queries em
// memória) porque as tabelas não têm FK direto para join via PostgREST —
// mesma razão do join de produto que existia antes da migration 056.
export interface UltimatesCycleWithProducts extends UltimatesCycleRecord {
  products: UltimatesCycleProductRef[];
}

export async function GET() {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();

  const { data: cycles, error: cyclesError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  if (cyclesError) {
    return NextResponse.json({ error: cyclesError.message }, { status: 500 });
  }

  const rows = (cycles ?? []) as UltimatesCycleRecord[];
  const cycleIds = rows.map((cycle) => cycle.id);

  const productIdsByCycle = new Map<string, string[]>();
  const allProductIds = new Set<string>();

  if (cycleIds.length > 0) {
    const { data: pairs, error: pairsError } = await supabase
      .from("dash_gestao_ultimates_cycle_products")
      .select("cycle_id, product_id")
      .in("cycle_id", cycleIds);

    if (pairsError) {
      return NextResponse.json({ error: pairsError.message }, { status: 500 });
    }

    for (const pair of (pairs ?? []) as { cycle_id: string; product_id: string }[]) {
      const list = productIdsByCycle.get(pair.cycle_id) ?? [];
      list.push(pair.product_id);
      productIdsByCycle.set(pair.cycle_id, list);
      allProductIds.add(pair.product_id);
    }
  }

  const productNameById = new Map<string, string>();

  if (allProductIds.size > 0) {
    const { data: products, error: productsError } = await supabase
      .from("dash_gestao_hotmart_products")
      .select("product_id, product_name")
      .in("product_id", Array.from(allProductIds));

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    for (const product of (products ?? []) as { product_id: string; product_name: string }[]) {
      productNameById.set(product.product_id, product.product_name);
    }
  }

  const withProducts: UltimatesCycleWithProducts[] = rows.map((cycle) => ({
    ...cycle,
    // Ordem por nome para o header do dashboard ser estável entre requisições
    // — o PostgREST não garante ordem numa tabela sem order by.
    products: (productIdsByCycle.get(cycle.id) ?? [])
      .map((productId) => ({
        product_id: productId,
        product_name: productNameById.get(productId) ?? null,
      }))
      .sort((a, b) =>
        (a.product_name ?? a.product_id).localeCompare(b.product_name ?? b.product_id, "pt-BR")
      ),
  }));

  return NextResponse.json({ cycles: withProducts });
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const { name, productIds, goalPercent } = body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  if (goalPercent !== undefined && goalPercent !== null) {
    if (typeof goalPercent !== "number" || Number.isNaN(goalPercent) || goalPercent < 0 || goalPercent > 100) {
      return NextResponse.json(
        { error: "goalPercent deve ser numérico entre 0 e 100" },
        { status: 400 }
      );
    }
  }

  // Deduplica antes de tudo: a PK composta de cycle_products rejeitaria a
  // duplicata com um 23505 que não diz nada ao gestor.
  const ids = Array.isArray(productIds)
    ? Array.from(
        new Set(
          productIds
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        )
      )
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um produto" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // As duas checagens abaixo existem SÓ pela mensagem: quem garante a
  // invariante é dash_gestao_ultimates_create_cycle, que repete as duas e
  // levanta exceção. Não remova a validação da RPC confiando nesta.
  const { data: products, error: productsError } = await supabase
    .from("dash_gestao_hotmart_products")
    .select("product_id, account_id")
    .in("product_id", ids);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  const found = (products ?? []) as { product_id: string; account_id: string }[];

  if (found.length !== ids.length) {
    return NextResponse.json(
      {
        error:
          "Produto não encontrado. Rode o sync de produtos em /api/hotmart/sync-products e tente novamente.",
      },
      { status: 400 }
    );
  }

  if (new Set(found.map((product) => product.account_id)).size > 1) {
    return NextResponse.json(
      { error: "Todos os produtos devem ser da mesma conta Hotmart" },
      { status: 400 }
    );
  }

  const { data: cycle, error: rpcError } = await supabase.rpc(
    "dash_gestao_ultimates_create_cycle",
    {
      p_name: name.trim(),
      p_product_ids: ids,
      p_goal_percent: goalPercent ?? null,
      p_created_by: userId,
    }
  );

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json({ cycle }, { status: 201 });
}
