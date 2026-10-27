import { ehCorPasta, COR_PADRAO, type CorPasta } from "./pastas-regras";
import type { SupabaseLike } from "@/lib/indicadores/service/types";

export interface PastaUsuario {
  id: string;
  nome: string;
  cor: CorPasta;
  /** Ids dos eventos (filtros) que estão na pasta. */
  eventoIds: string[];
}

export interface PastasUsuario {
  /** false quando as tabelas ainda não existem (migration 074 pendente): a tela fica só com a lista de eventos. */
  disponivel: boolean;
  pastas: PastaUsuario[];
}

const INDISPONIVEL: PastasUsuario = { disponivel: false, pastas: [] };

/** Tabela ausente no Postgres (42P01) ou fora do cache do PostgREST (PGRST205). */
export function tabelaAusente(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  return erro.code === "42P01" || erro.code === "PGRST205" || /does not exist|schema cache/i.test(erro.message ?? "");
}

/** Lê as pastas da conta com seus eventos. Nunca lança: qualquer falha vira "indisponível". */
export async function carregarPastasUsuario(supabase: SupabaseLike, accountId: string): Promise<PastasUsuario> {
  const pastas = await supabase
    .from("dash_gestao_event_folders")
    .select("id, name, color")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (pastas.error) {
    if (!tabelaAusente(pastas.error)) console.error("v2/eventos: leitura das pastas falhou", pastas.error);
    return INDISPONIVEL;
  }

  const linhas = (pastas.data ?? []) as { id: string; name: string; color: string }[];
  if (linhas.length === 0) return { disponivel: true, pastas: [] };

  const itens = await supabase
    .from("dash_gestao_event_folder_items")
    .select("folder_id, filter_id")
    .in(
      "folder_id",
      linhas.map((l) => l.id),
    );

  if (itens.error) {
    if (!tabelaAusente(itens.error)) console.error("v2/eventos: leitura dos vínculos das pastas falhou", itens.error);
    return INDISPONIVEL;
  }

  const porPasta = new Map<string, string[]>();
  for (const item of (itens.data ?? []) as { folder_id: string; filter_id: string }[]) {
    porPasta.set(item.folder_id, [...(porPasta.get(item.folder_id) ?? []), item.filter_id]);
  }

  return {
    disponivel: true,
    pastas: linhas.map((l) => ({
      id: l.id,
      nome: l.name,
      cor: ehCorPasta(l.color) ? l.color : COR_PADRAO,
      eventoIds: porPasta.get(l.id) ?? [],
    })),
  };
}
