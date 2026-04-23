import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_entrega_nivel_a_ultimate_mensal")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { month_year, nps_medio_entregas, perc_presenca_sessao_feedback, mau_usuarios_ativos_mensal } = body;

  if (!month_year || typeof month_year !== "string" || !/^\d{4}-\d{2}$/.test(month_year)) {
    return NextResponse.json({ error: "month_year deve estar no formato YYYY-MM" }, { status: 400 });
  }
  if (typeof nps_medio_entregas !== "number") {
    return NextResponse.json({ error: "nps_medio_entregas deve ser um número" }, { status: 400 });
  }
  if (typeof perc_presenca_sessao_feedback !== "number") {
    return NextResponse.json({ error: "perc_presenca_sessao_feedback deve ser um número" }, { status: 400 });
  }
  if (typeof mau_usuarios_ativos_mensal !== "number" || !Number.isInteger(mau_usuarios_ativos_mensal)) {
    return NextResponse.json({ error: "mau_usuarios_ativos_mensal deve ser um número inteiro" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_entrega_nivel_a_ultimate_mensal")
    .insert({ month_year, nps_medio_entregas, perc_presenca_sessao_feedback, mau_usuarios_ativos_mensal })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
