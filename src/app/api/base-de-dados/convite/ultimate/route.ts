import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

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
  const { projeto, month_year, numero_absoluto } = body;

  if (!projeto || typeof projeto !== "string" || projeto.trim() === "") {
    return NextResponse.json({ error: "projeto é obrigatório" }, { status: 400 });
  }
  if (!month_year || typeof month_year !== "string" || !/^\d{4}-\d{2}$/.test(month_year)) {
    return NextResponse.json({ error: "month_year deve estar no formato YYYY-MM" }, { status: 400 });
  }
  if (typeof numero_absoluto !== "number" || !Number.isInteger(numero_absoluto)) {
    return NextResponse.json({ error: "numero_absoluto deve ser um número inteiro" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const normalizedProjectName = normalizeProjectName(projeto);
  const { data: projectRows, error: projectError } = await supabase
    .from("dash_gestao_convite_projetos")
    .select("nome_projeto, grupo")
    .eq("grupo", "ultimate");

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const matchedProject = (projectRows ?? []).find(
    (row) => normalizeProjectName(String(row.nome_projeto ?? "")) === normalizedProjectName
  );

  if (!matchedProject) {
    return NextResponse.json(
      { error: "Selecione um projeto válido do Ultimate" },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_ultimate")
    .insert({
      projeto: String(matchedProject.nome_projeto),
      month_year: `${month_year}-01`,
      numero_absoluto,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
