import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listSixDados } from "@/lib/indicadores/service/six-dados";

/**
 * Six Dados (PRD seção 5.3): lista Eventos ativos + relatório de IA em cache
 * de cada um, com flag `stale` (RF-3). Resposta imediata — nunca gera; a
 * geração sob demanda é responsabilidade de POST /api/indicadores/six-dados/generate.
 */
export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const account_id = request.nextUrl.searchParams.get("account_id");
  if (!account_id) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  try {
    const items = await listSixDados(account_id, supabase);
    return NextResponse.json(items);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
