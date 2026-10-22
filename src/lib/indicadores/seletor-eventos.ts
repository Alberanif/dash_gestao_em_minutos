import type { FilterRecord } from "@/types/indicadores";
import { listFilters, type LeituraResult } from "./leitura";
import type { SupabaseLike } from "./service/types";

/**
 * Leitura do seletor de eventos para páginas de servidor: o que a tela Eventos
 * do V1 monta com `GET /api/accounts` (primeira conta) seguido de
 * `GET /api/indicadores/filters`, numa chamada só.
 */

export interface EventosSeletor {
  /** null quando ainda não há nenhuma conta cadastrada. */
  accountId: string | null;
  filters: FilterRecord[];
}

/** Conta usada pelo Indicadores: a mais antiga, igual ao `accounts[0]` do V1. */
export async function loadContaPrincipal(supabase: SupabaseLike): Promise<LeituraResult<string | null>> {
  const { data, error } = await supabase
    .from("dash_gestao_accounts")
    .select("id")
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };
  const primeira = Array.isArray(data) ? data[0] : undefined;
  return { data: primeira?.id ?? null };
}

export async function loadEventosSeletor(supabase: SupabaseLike): Promise<LeituraResult<EventosSeletor>> {
  const conta = await loadContaPrincipal(supabase);
  if (conta.error !== undefined) return { error: conta.error };
  if (conta.data === null) return { data: { accountId: null, filters: [] } };

  const filters = await listFilters(conta.data, supabase);
  if (filters.error !== undefined) return { error: filters.error };
  return { data: { accountId: conta.data, filters: filters.data } };
}
