import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Paginate to bypass Supabase's default 1000-row limit and collect all distinct products
  const seen = new Set<string>();
  const products: { product_id: string; product_name: string }[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error: dbError } = await supabase
      .from("dash_gestao_hotmart_sales")
      .select("product_id, product_name")
      .eq("account_id", accountId)
      .range(from, from + PAGE_SIZE - 1);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    for (const row of data ?? []) {
      if (!seen.has(row.product_id)) {
        seen.add(row.product_id);
        products.push({ product_id: row.product_id, product_name: row.product_name });
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  products.sort((a, b) => a.product_name.localeCompare(b.product_name, "pt-BR"));

  return NextResponse.json(products);
}
