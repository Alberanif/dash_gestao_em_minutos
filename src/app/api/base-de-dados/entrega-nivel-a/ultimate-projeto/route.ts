import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_entrega_nivel_a_ultimate_projeto")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { projeto, perc_presenca_encontros_online_dia1, perc_presenca_encontro_presencial } = body;

  if (!projeto || typeof projeto !== "string" || projeto.trim() === "") {
    return NextResponse.json({ error: "projeto é obrigatório" }, { status: 400 });
  }
  if (typeof perc_presenca_encontros_online_dia1 !== "number") {
    return NextResponse.json({ error: "perc_presenca_encontros_online_dia1 deve ser um número" }, { status: 400 });
  }
  if (typeof perc_presenca_encontro_presencial !== "number") {
    return NextResponse.json({ error: "perc_presenca_encontro_presencial deve ser um número" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_entrega_nivel_a_ultimate_projeto")
    .insert({ projeto: projeto.trim(), perc_presenca_encontros_online_dia1, perc_presenca_encontro_presencial })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
