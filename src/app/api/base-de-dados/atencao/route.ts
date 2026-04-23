import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_atencao")
    .select("*")
    .order("week_start", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { week_start, week_end, oportunidades } = body;

  if (!week_start || !week_end) {
    return NextResponse.json({ error: "week_start e week_end são obrigatórios" }, { status: 400 });
  }
  if (typeof oportunidades !== "number" || !Number.isInteger(oportunidades)) {
    return NextResponse.json({ error: "oportunidades deve ser um número inteiro" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_atencao")
    .insert({ week_start, week_end, oportunidades })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
