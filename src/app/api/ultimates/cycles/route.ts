import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesCycleRecord } from "@/types/ultimates";

// Ciclo com o nome do produto anexado (join manual com
// dash_gestao_hotmart_products, feito em memória porque as tabelas não têm
// FK direto para join via PostgREST). Específico desta rota — ver
// restrição de não editar src/types/ultimates.ts.
export interface UltimatesCycleWithProductName extends UltimatesCycleRecord {
  product_name: string | null;
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
  const productIds = Array.from(new Set(rows.map((cycle) => cycle.product_id)));

  const productNameById = new Map<string, string>();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("dash_gestao_hotmart_products")
      .select("product_id, product_name")
      .in("product_id", productIds);

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    for (const product of (products ?? []) as { product_id: string; product_name: string }[]) {
      productNameById.set(product.product_id, product.product_name);
    }
  }

  const withProductName: UltimatesCycleWithProductName[] = rows.map((cycle) => ({
    ...cycle,
    product_name: productNameById.get(cycle.product_id) ?? null,
  }));

  return NextResponse.json({ cycles: withProductName });
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
