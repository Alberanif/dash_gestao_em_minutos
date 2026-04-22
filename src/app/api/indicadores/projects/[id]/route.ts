import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { name, hotmart_account_id, hotmart_product_ids, campaign_terms, organic_lead_events } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .update({
      name: name.trim(),
      hotmart_account_id: hotmart_account_id ?? null,
      hotmart_product_ids: Array.isArray(hotmart_product_ids) ? hotmart_product_ids : [],
      campaign_terms: Array.isArray(campaign_terms) ? campaign_terms : [],
      organic_lead_events: Array.isArray(organic_lead_events) ? organic_lead_events : [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const { error: dbError } = await supabase
    .from("dash_gestao_indicadores_projects")
    .delete()
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
