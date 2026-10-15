import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const accountId = request.nextUrl.searchParams.get("account_id");
  const productId = request.nextUrl.searchParams.get("product_id");

  // account_id é opcional: product_id é único entre contas (o sync faz upsert por
  // product_id), e o Debriefing não conhece a conta Hotmart — só a primeira conta
  // de /api/accounts, que pode ser de outra plataforma e devolveria lista vazia.
  if (!productId) {
    return NextResponse.json(
      { error: "product_id é obrigatório" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const includeInactive =
    request.nextUrl.searchParams.get("include_inactive") === "true";

  let query = supabase
    .from("dash_gestao_hotmart_offers")
    .select(
      includeInactive
        ? "offer_code, offer_name, price, currency, is_main_offer, is_active"
        : "offer_code, offer_name, price, currency, is_main_offer"
    )
    .eq("product_id", productId);

  if (accountId) query = query.eq("account_id", accountId);

  if (includeInactive) {
    query = query
      .order("is_active", { ascending: false })
      .order("is_main_offer", { ascending: false });
  } else {
    query = query
      .eq("is_active", true)
      .order("is_main_offer", { ascending: false });
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
