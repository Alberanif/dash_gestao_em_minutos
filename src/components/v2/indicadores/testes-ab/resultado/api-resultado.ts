import { DIMENSOES, type FiltrosDoResultado, type ResultadoAb } from "./tipos";

export const ENDPOINT_RESULTADO = "/api/central-de-links/ab-resultado";

/** Monta a query: `teste` primeiro, depois só os filtros preenchidos (a ordem das dimensões é fixa). */
export function montarQuery(teste: string, filtros: FiltrosDoResultado): string {
  const q = new URLSearchParams({ teste });
  for (const d of DIMENSOES) {
    const v = filtros[d.chave];
    if (v) q.set(d.chave, v);
  }
  return q.toString();
}

/** Busca o resultado; erro vira Error com a mensagem em português do servidor. */
export async function buscarResultado(teste: string, filtros: FiltrosDoResultado): Promise<ResultadoAb> {
  let r: Response;
  try {
    r = await fetch(`${ENDPOINT_RESULTADO}?${montarQuery(teste, filtros)}`, {
      method: "GET",
      cache: "no-store",
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Tente de novo.");
  }
  let dados: (Partial<ResultadoAb> & { erro?: string; error?: string }) | null = null;
  try {
    dados = await r.json();
  } catch {
    dados = null;
  }
  if (!r.ok) throw new Error(dados?.erro ?? dados?.error ?? `Erro ${r.status} ao falar com o servidor.`);
  if (!dados || !dados.teste || !Array.isArray(dados.variantes)) throw new Error("Resposta inesperada do servidor.");
  return dados as ResultadoAb;
}
