import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { FilterRecord } from "@/types/indicadores";

type Params = { id: string };

export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { name, hotmart_products, meta_ads_terms, captacao_leads_eventos } = body ?? {};

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_filters")
    .update({ name, hotmart_products, meta_ads_terms, captacao_leads_eventos, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    if (dbError.code === "PGRST116") {
      return NextResponse.json({ error: "Filter not found" }, { status: 404 });
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Filter not found" }, { status: 404 });
  }

  return NextResponse.json(data as FilterRecord);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();
  const { error: dbError } = await supabase
    .from("dash_gestao_filters")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
