import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadEventosSeletor } from "@/lib/indicadores/seletor-eventos";
import { EventosLista } from "@/components/v2/eventos/eventos-lista";
import { EventosErro, EventosVazio } from "@/components/v2/eventos/estados";
import { carregarPastasUsuario } from "@/components/v2/eventos/pastas-servidor";
import { atualizarPasta, criarPasta, definirPastasDoEvento, excluirPasta } from "./acoes";

export const metadata: Metadata = { title: "Eventos" };

export default async function EventosV2Page() {
  const supabase = await createSupabaseServerClient();
  const resultado = await loadEventosSeletor(supabase);

  if (resultado.error !== undefined) {
    console.error("v2/eventos: leitura dos eventos falhou", resultado.error);
    return <EventosErro />;
  }

  const { accountId, filters } = resultado.data;
  if (accountId === null || filters.length === 0) return <EventosVazio accountId={accountId} />;

  // Sem a migration das pastas a tela segue só com a lista de eventos.
  const pastas = await carregarPastasUsuario(supabase, accountId);

  return (
    <EventosLista
      accountId={accountId}
      filters={filters}
      pastasUsuario={pastas.pastas}
      pastasDisponiveis={pastas.disponivel}
      acoes={{ criar: criarPasta, atualizar: atualizarPasta, excluir: excluirPasta, definirPastasDoEvento }}
    />
  );
}
