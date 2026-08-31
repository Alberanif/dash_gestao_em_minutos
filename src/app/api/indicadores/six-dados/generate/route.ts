import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateSixDadosForFilter } from "@/lib/indicadores/service/six-dados-generate";

/**
 * Six Dados (PRD seção 5.3): geração sob demanda do relatório de UM Evento.
 * Autentica, valida o filtro (existe + ativo) e delega ao serviço a idempotência
 * (RF-3) e o lock de concorrência atômico (RF-5) — o LLM roda no máximo 1× por
 * Evento mesmo com dois clientes abrindo a tela ao mesmo tempo.
 *
 * Escreve via service_role (a tabela só permite escrita fora da RLS). Cada POST
 * é uma invocação serverless independente (o cliente dispara um por Evento stale).
 */
// Perdedor da corrida pode ficar em poll bloqueante por até ~30s (MAX_WAIT_MS
// em six-dados-generate.ts) + o tempo de geração do vencedor em si; folga
// acima disso para não ser cortado pela plataforma antes de devolver o item.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
  }

  const filterId = (body as { filterId?: unknown })?.filterId;
  if (typeof filterId !== "string" || filterId.length === 0) {
    return NextResponse.json({ error: "filterId is required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  try {
    const outcome = await generateSixDadosForFilter(filterId, { supabase });

    switch (outcome.status) {
      case "not_found":
        return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
      case "not_active":
        return NextResponse.json({ error: "Evento não está ativo" }, { status: 409 });
      default:
        // cached | generated | waited — todos devolvem o item do Evento.
        return NextResponse.json(outcome.item);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
