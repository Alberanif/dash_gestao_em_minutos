import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_funnels")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { name, type, start_date, end_date, goal_sales, config } = body;

  if (!name || !type || !start_date || !end_date || !goal_sales || !config) {
    return NextResponse.json(
      { error: "name, type, start_date, end_date, goal_sales e config são obrigatórios" },
      { status: 400 }
    );
  }

  if (!["destrave"].includes(type)) {
    return NextResponse.json({ error: "Tipo de funil inválido" }, { status: 400 });
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return NextResponse.json(
      { error: "end_date deve ser posterior a start_date" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_funnels")
    .insert({ name, type, start_date, end_date, goal_sales, config })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
