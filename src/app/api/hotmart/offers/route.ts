import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  const productId = request.nextUrl.searchParams.get("product_id");

  if (!accountId || !productId) {
    return NextResponse.json(
      { error: "account_id e product_id são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data, error: dbError } = await supabase
    .from("dash_gestao_hotmart_offers")
    .select("offer_code, offer_name, price, currency, is_main_offer")
    .eq("account_id", accountId)
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("is_main_offer", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
