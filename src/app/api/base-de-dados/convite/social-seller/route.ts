import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_social_seller")
    .select("*")
    .order("week_start", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { week_start, week_end, reunioes_realizadas, vendas_realizadas } = body;

  if (!week_start || !week_end) {
    return NextResponse.json({ error: "week_start e week_end são obrigatórios" }, { status: 400 });
  }
  for (const [key, val] of Object.entries({ reunioes_realizadas, vendas_realizadas })) {
    if (typeof val !== "number" || !Number.isInteger(val)) {
      return NextResponse.json({ error: `${key} deve ser um número inteiro` }, { status: 400 });
    }
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_social_seller")
    .insert({ week_start, week_end, reunioes_realizadas, vendas_realizadas })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
