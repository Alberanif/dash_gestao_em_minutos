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
    .from("dash_gestao_convite_mcc")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { projeto, perc_ultimate, perc_pc_ao_vivo } = body;

  if (!projeto || typeof projeto !== "string" || projeto.trim() === "") {
    return NextResponse.json({ error: "projeto é obrigatório" }, { status: 400 });
  }
  for (const [key, val] of Object.entries({ perc_ultimate, perc_pc_ao_vivo })) {
    if (typeof val !== "number") {
      return NextResponse.json({ error: `${key} deve ser um número` }, { status: 400 });
    }
  }

  const supabase = createSupabaseServiceClient();
  const normalizedProjectName = normalizeProjectName(projeto);
  const { data: projectRows, error: projectError } = await supabase
    .from("dash_gestao_convite_projetos")
    .select("nome_projeto, grupo")
    .eq("grupo", "mcc");

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const matchedProject = (projectRows ?? []).find(
    (row) => normalizeProjectName(String(row.nome_projeto ?? "")) === normalizedProjectName
  );

  if (!matchedProject) {
    return NextResponse.json(
      { error: "Selecione um projeto válido do MCC" },
      { status: 400 }
    );
  }

  const { data, error: dbError } = await supabase
    .from("dash_gestao_convite_mcc")
    .insert({
      projeto: String(matchedProject.nome_projeto),
      perc_ultimate,
      perc_pc_ao_vivo,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
