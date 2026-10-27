/** Forma dos testes A/B devolvida por /api/central-de-links/ab-testes (idêntica à do api/ab-testes.js original). */
export type EstadoDoTeste = "rascunho" | "ativo" | "encerrado";

export interface VarianteDoTeste {
  id: string;
  link_id: string;
  rotulo: string;
  controle: boolean;
  central_links: { label: string; url: string; tipo: string; deleted: boolean } | null;
}

export interface TesteAb {
  id: string;
  nome: string;
  status: EstadoDoTeste;
  created_at: string;
  iniciado_em: string | null;
  encerrado_em: string | null;
  vencedor_variante: string | null;
  anotacao: string | null;
  ab_variantes: VarianteDoTeste[] | null;
}

export interface VarianteEnviada {
  link_id: string;
  rotulo: string;
  controle: boolean;
}

export const ENDPOINT_TESTES = "/api/central-de-links/ab-testes";

/** Chama a API e devolve o JSON; erro vira Error com a mensagem em português do servidor. */
export async function chamarTestes<T>(corpo: { acao: string } & Record<string, unknown>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(ENDPOINT_TESTES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Tente de novo.");
  }
  let dados: { erro?: string; error?: string } | null = null;
  try {
    dados = await r.json();
  } catch {
    dados = null;
  }
  if (!r.ok) throw new Error(dados?.erro ?? dados?.error ?? "Não foi possível concluir a ação.");
  return dados as T;
}
