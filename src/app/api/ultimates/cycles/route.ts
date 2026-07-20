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
  const { name, productId, goalPercent } = body ?? {};

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

  if (typeof productId !== "string" || productId.trim().length === 0) {
    return NextResponse.json({ error: "productId é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: product, error: productError } = await supabase
    .from("dash_gestao_hotmart_products")
    .select("account_id")
    .eq("product_id", productId)
    .single();

  if (productError || !product) {
    return NextResponse.json(
      {
        error:
          "Produto não encontrado. Rode o sync de produtos em /api/hotmart/sync-products e tente novamente.",
      },
      { status: 400 }
    );
  }

  const { data: cycle, error: insertError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .insert({
      name: name.trim(),
      product_id: productId,
      account_id: (product as { account_id: string }).account_id,
      goal_percent: goalPercent ?? null,
      status: "ativo",
      created_by: userId,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ cycle }, { status: 201 });
}
