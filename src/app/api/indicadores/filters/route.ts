import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { createFilter, listFilters } from "@/lib/indicadores/leitura";
import { validateDebriefingProducts } from "@/lib/indicadores/debriefing-products";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const account_id = request.nextUrl.searchParams.get("account_id");
  if (!account_id) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: dbError } = await listFilters(account_id, supabase);

  if (dbError !== undefined) {
    return NextResponse.json({ error: dbError }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const {
    account_id,
    name,
    hotmart_products = [],
    main_hotmart_product = null,
    debriefing_offer_codes = null,
    debriefing_products,
    meta_ads_terms = [],
    captacao_leads_eventos = [],
  } = body ?? {};

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const debriefing = validateDebriefingProducts(debriefing_products === undefined ? null : debriefing_products);
  if (!debriefing.ok) {
    return NextResponse.json({ error: debriefing.error }, { status: 400 });
  }
  if (hotmart_products.length === 0 && meta_ads_terms.length === 0 && captacao_leads_eventos.length === 0) {
    return NextResponse.json(
      { error: "at least one of hotmart_products, meta_ads_terms, or captacao_leads_eventos must be non-empty" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await createFilter(
    {
      account_id,
      name,
      hotmart_products,
      main_hotmart_product,
      debriefing_offer_codes,
      debriefing_products: debriefing_products !== undefined ? debriefing.value : undefined,
      meta_ads_terms,
      captacao_leads_eventos,
    },
    supabase
  );

  if (dbError !== undefined) {
    return NextResponse.json({ error: dbError }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
