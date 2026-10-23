"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DadosDasFontes, Fonte, FonteId } from "@/lib/indicadores/dashboard-evento";
import { useEvento } from "./contexto";
import { buscarFonte } from "./fontes-cliente";

/**
 * Uma fonte do evento. O dado do servidor só vale para a consulta que ele respondeu;
 * ao trocar o filtro, o dado anterior fica na tela (placeholder) até o novo chegar.
 */
export function useFonte<K extends FonteId>(fonte: K, inicial?: Fonte<DadosDasFontes[K]> | null) {
  const { consulta, chaveInicial } = useEvento();
  return useQuery({
    queryKey: [fonte, consulta.chave],
    queryFn: ({ signal }) => buscarFonte(fonte, consulta, signal),
    initialData: inicial && consulta.chave === chaveInicial ? inicial : undefined,
    placeholderData: keepPreviousData,
  });
}
