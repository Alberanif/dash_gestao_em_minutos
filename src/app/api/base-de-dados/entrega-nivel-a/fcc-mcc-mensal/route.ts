import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_entrega_nivel_a_fcc_mcc_mensal")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { month_year, banco_formacoes_nao_realizadas_pago } = body;

  if (!month_year || typeof month_year !== "string" || !/^\d{4}-\d{2}$/.test(month_year)) {
    return NextResponse.json({ error: "month_year deve estar no formato YYYY-MM" }, { status: 400 });
  }
  if (typeof banco_formacoes_nao_realizadas_pago !== "number" || !Number.isInteger(banco_formacoes_nao_realizadas_pago)) {
    return NextResponse.json({ error: "banco_formacoes_nao_realizadas_pago deve ser um número inteiro" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_entrega_nivel_a_fcc_mcc_mensal")
    .insert({ month_year, banco_formacoes_nao_realizadas_pago })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
