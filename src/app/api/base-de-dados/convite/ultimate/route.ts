import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_ultimate")
    .select("*")
    .order("month_year", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { month_year, numero_absoluto } = body;

  if (!month_year || typeof month_year !== "string" || !/^\d{4}-\d{2}$/.test(month_year)) {
    return NextResponse.json({ error: "month_year deve estar no formato YYYY-MM" }, { status: 400 });
  }
  if (typeof numero_absoluto !== "number" || !Number.isInteger(numero_absoluto)) {
    return NextResponse.json({ error: "numero_absoluto deve ser um número inteiro" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_ultimate")
    .insert({ month_year: `${month_year}-01`, numero_absoluto })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
