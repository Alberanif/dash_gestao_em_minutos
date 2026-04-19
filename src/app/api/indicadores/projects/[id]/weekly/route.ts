import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from("dash_gestao_indicadores_weekly_data")
    .select("*")
    .eq("project_id", id)
    .order("week_start", { ascending: true });

  if (start_date) query = query.gte("week_start", start_date);
  if (end_date) query = query.lte("week_start", end_date);

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id: project_id } = await params;
  const body = await request.json();
  const {
    week_start, week_end,
    meta_connect_rate, meta_lp_conversion, meta_cpl_traffic,
    google_spend, google_cpm, google_leads,
    google_connect_rate, google_cpl_traffic, google_lp_conversion,
  } = body;

  if (!week_start || !week_end) {
    return NextResponse.json({ error: "week_start e week_end são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_indicadores_weekly_data")
    .upsert(
      {
        project_id,
        week_start,
        week_end,
        meta_connect_rate: meta_connect_rate ?? null,
        meta_lp_conversion: meta_lp_conversion ?? null,
        meta_cpl_traffic: meta_cpl_traffic ?? null,
        google_spend: google_spend ?? null,
        google_cpm: google_cpm ?? null,
        google_leads: google_leads ?? null,
        google_connect_rate: google_connect_rate ?? null,
        google_cpl_traffic: google_cpl_traffic ?? null,
        google_lp_conversion: google_lp_conversion ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,week_start" }
    )
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
