import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { streamAgentResponse } from "@/lib/agent/graph";
import { todayInSaoPaulo } from "@/lib/agent/prompt";
import { expandFilter } from "@/lib/indicadores/filter-expansion";
import type { FilterRecord } from "@/types/indicadores";

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { message, history, filterId, offerCode, startDate, endDate } = body ?? {};

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (!filterId) {
    return NextResponse.json({ error: "filterId is required" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }

  // O servidor é a fonte de verdade sobre o conteúdo do filtro. O cliente manda
  // só o id: não pode forjar quais produtos ou termos serão lidos.
  const supabase = createSupabaseServiceClient();
  const { data: filterRow, error: filterError } = await supabase
    .from("dash_gestao_filters")
    .select("*")
    .eq("id", filterId)
    .single();

  if (filterError || !filterRow) {
    return NextResponse.json({ error: "Filtro não encontrado" }, { status: 400 });
  }

  const filter = expandFilter(filterRow as FilterRecord, offerCode ?? null);
  const period = { startDate, endDate };

  const stream = await streamAgentResponse({
    message,
    history: history ?? [],
    // Quando o usuário aperta parar, o fetch é abortado e a conexão cai; o
    // runtime aborta este signal. Repassá-lo ao agente é o que faz o trabalho em
    // curso ser cancelado, em vez de continuar gerando para ninguém.
    signal: request.signal,
    scope: { filter, supabase },
    state: {
      today: todayInSaoPaulo(new Date()),
      period,
      filterName: (filterRow as FilterRecord).name,
      offerCode: filter.offerCode,
      sources: filter.sources,
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
