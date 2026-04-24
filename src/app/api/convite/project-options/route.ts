import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  CONVITE_GROUP_OPTIONS,
  type ConviteGroup,
  type ConviteProjectOption,
} from "@/types/convite";

const ALLOWED_GROUPS = new Set<ConviteGroup>(CONVITE_GROUP_OPTIONS.map((option) => option.value));

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const groupParam = request.nextUrl.searchParams.get("group");
  const group = groupParam && ALLOWED_GROUPS.has(groupParam as ConviteGroup)
    ? (groupParam as ConviteGroup)
    : null;

  if (groupParam && !group) {
    return NextResponse.json({ error: "Grupo não suportado" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const query = supabase
    .from("dash_gestao_convite_projetos")
    .select("id, grupo, nome_projeto")
    .order("nome_projeto", { ascending: true });

  if (group) {
    query.eq("grupo", group);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const projectOptions: ConviteProjectOption[] = ((data ?? []) as ConviteProjectOption[]).map((row) => ({
    id: row.id,
    grupo: row.grupo,
    nome_projeto: row.nome_projeto,
  }));

  return NextResponse.json(projectOptions);
}
