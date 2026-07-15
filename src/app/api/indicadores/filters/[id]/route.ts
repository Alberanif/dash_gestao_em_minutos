import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { FILTER_STATUSES, type FilterRecord, type FilterStatus } from "@/types/indicadores";

type Params = { id: string };

export async function PUT(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { name, hotmart_products, meta_ads_terms, captacao_leads_eventos, status } = body ?? {};

  if (status !== undefined && !FILTER_STATUSES.includes(status as FilterStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${FILTER_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  const update: Record<string, unknown> = {
    name,
    hotmart_products,
    meta_ads_terms,
    captacao_leads_eventos,
    updated_at: new Date().toISOString(),
  };

  if (status !== undefined) {
    const { data: current } = await supabase
      .from("dash_gestao_filters")
      .select("status")
      .eq("id", id)
      .single();

    update.status = status;
    if (current && current.status !== status) {
      update.status_changed_at = new Date().toISOString();
    }
  }

  const { data, error: dbError } = await supabase
    .from("dash_gestao_filters")
    .update(update)
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
