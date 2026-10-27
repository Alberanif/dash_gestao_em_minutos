import {
  ROTA_DA_FONTE,
  ZERADOS,
  fonteConfigurada,
  paramsDaFonte,
  type Consulta,
  type DadosDasFontes,
  type Fonte,
  type FonteId,
} from "@/lib/indicadores/dashboard-evento";

/**
 * Busca uma fonte nas rotas atuais de `/api/indicadores/*`, igual ao V1: fonte
 * não configurada vale zero sem ir à rede; resposta fora de 2xx lança, para o
 * TanStack Query marcar o bloco com erro e permitir nova tentativa.
 */
export async function buscarFonte<K extends FonteId>(
  fonte: K,
  consulta: Consulta,
  signal?: AbortSignal,
): Promise<Fonte<DadosDasFontes[K]>> {
  if (!fonteConfigurada(consulta.expanded, fonte)) {
    return { data: ZERADOS[fonte] as DadosDasFontes[K], chave: consulta.chave };
  }
  const resposta = await fetch(`${ROTA_DA_FONTE[fonte]}${paramsDaFonte(consulta, fonte)}`, { signal });
  if (!resposta.ok) throw new Error(`API error ${resposta.status}`);
  return { data: (await resposta.json()) as DadosDasFontes[K], chave: consulta.chave };
}
