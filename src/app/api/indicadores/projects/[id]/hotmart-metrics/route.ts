import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { HotmartMetrics, HotmartProductMetrics } from "@/types/indicadores";

const HOTMART_STATUS_APPROVED = ["COMPLETE", "APPROVED"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json(
      { error: "start_date e end_date são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const { data: project, error: projectError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .select("hotmart_product_ids")
    .eq("id", id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const productIds: string[] = project.hotmart_product_ids ?? [];

  if (productIds.length === 0) {
    return NextResponse.json({
      products: [],
      total_sales: 0,
      total_revenue: 0,
      has_non_brl: false,
    } satisfies HotmartMetrics);
  }

  const [brlResult, nonBrlResult] = await Promise.all([
    supabase
      .from("dash_gestao_hotmart_sales")
      .select("product_id, product_name, price")
      .in("product_id", productIds)
      .in("status", HOTMART_STATUS_APPROVED)
      .eq("currency", "BRL")
      .gte("purchase_date", start_date)
      .lte("purchase_date", end_date + "T23:59:59"),
    supabase
      .from("dash_gestao_hotmart_sales")
      .select("id", { count: "exact", head: true })
      .in("product_id", productIds)
      .in("status", HOTMART_STATUS_APPROVED)
      .neq("currency", "BRL")
      .gte("purchase_date", start_date)
      .lte("purchase_date", end_date + "T23:59:59"),
  ]);

  if (brlResult.error) {
    return NextResponse.json({ error: brlResult.error.message }, { status: 500 });
  }

  const rows = brlResult.data ?? [];

  const byProduct = new Map<
    string,
    { product_name: string; sales_count: number; revenue: number }
  >();

  for (const row of rows) {
    const existing = byProduct.get(row.product_id);
    if (existing) {
      existing.sales_count += 1;
      existing.revenue += row.price ?? 0;
    } else {
      byProduct.set(row.product_id, {
        product_name: row.product_name,
        sales_count: 1,
        revenue: row.price ?? 0,
      });
    }
  }

  const products: HotmartProductMetrics[] = [...byProduct.entries()].map(
    ([product_id, data]) => ({
      product_id,
      product_name: data.product_name,
      sales_count: data.sales_count,
      revenue: data.revenue,
    })
  );

  const total_sales = products.reduce((s, p) => s + p.sales_count, 0);
  const total_revenue = products.reduce((s, p) => s + p.revenue, 0);
  const has_non_brl = (nonBrlResult.count ?? 0) > 0;

  return NextResponse.json({
    products,
    total_sales,
    total_revenue,
    has_non_brl,
  } satisfies HotmartMetrics);
}
