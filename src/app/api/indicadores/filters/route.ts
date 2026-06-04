import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import type { FilterRecord } from "@/types/indicadores";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const account_id = request.nextUrl.searchParams.get("account_id");
  if (!account_id) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_filters")
    .select("*")
    .eq("account_id", account_id)
    .order("name", { ascending: true });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data as FilterRecord[]);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { account_id, name, hotmart_products = [], meta_ads_terms = [], captacao_leads_eventos = [] } = body ?? {};

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (hotmart_products.length === 0 && meta_ads_terms.length === 0 && captacao_leads_eventos.length === 0) {
    return NextResponse.json(
      { error: "at least one of hotmart_products, meta_ads_terms, or captacao_leads_eventos must be non-empty" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_filters")
    .insert({ account_id, name, hotmart_products, meta_ads_terms, captacao_leads_eventos })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data as FilterRecord, { status: 201 });
}
