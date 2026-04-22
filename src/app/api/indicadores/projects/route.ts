import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { name, hotmart_account_id, hotmart_product_ids, campaign_terms, organic_lead_events } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .insert({
      name: name.trim(),
      hotmart_account_id: hotmart_account_id ?? null,
      hotmart_product_ids: Array.isArray(hotmart_product_ids) ? hotmart_product_ids : [],
      campaign_terms: Array.isArray(campaign_terms) ? campaign_terms : [],
      organic_lead_events: Array.isArray(organic_lead_events) ? organic_lead_events : [],
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
