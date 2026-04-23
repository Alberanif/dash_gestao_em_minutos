import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_funil_destrave")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { projeto, comparecimento, conv_produto_principal, conv_downsell, conv_upsell, cac_geral } = body;

  if (!projeto || typeof projeto !== "string" || projeto.trim() === "") {
    return NextResponse.json({ error: "projeto é obrigatório" }, { status: 400 });
  }
  if (typeof comparecimento !== "number" || !Number.isInteger(comparecimento)) {
    return NextResponse.json({ error: "comparecimento deve ser um número inteiro" }, { status: 400 });
  }
  for (const [key, val] of Object.entries({ conv_produto_principal, conv_downsell, conv_upsell, cac_geral })) {
    if (typeof val !== "number") {
      return NextResponse.json({ error: `${key} deve ser um número` }, { status: 400 });
    }
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_funil_destrave")
    .insert({ projeto: projeto.trim(), comparecimento, conv_produto_principal, conv_downsell, conv_upsell, cac_geral })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
