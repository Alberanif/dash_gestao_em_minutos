import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_ltv_solides")
    .select("*")
    .order("period_start", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { period_start, period_end, assinaturas_ativas, assinaturas_canceladas, novas_assinaturas } = body;

  if (!period_start || !period_end) {
    return NextResponse.json({ error: "period_start e period_end são obrigatórios" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_ltv_solides")
    .insert({
      period_start,
      period_end,
      assinaturas_ativas: assinaturas_ativas ?? 0,
      assinaturas_canceladas: assinaturas_canceladas ?? 0,
      novas_assinaturas: novas_assinaturas ?? 0,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
