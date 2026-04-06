import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const accountId = params.get("account_id");
  const startDate = params.get("start_date");
  const endDate = params.get("end_date");
  const productId = params.get("product_id");

  if (!accountId) {
    return NextResponse.json({ error: "account_id é obrigatório" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("dash_gestao_hotmart_sales")
    .select("*")
    .eq("account_id", accountId)
    .order("purchase_date", { ascending: false });

  if (startDate) query = query.gte("purchase_date", startDate);
  if (endDate) query = query.lte("purchase_date", endDate);
  if (productId) query = query.eq("product_id", productId);

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
