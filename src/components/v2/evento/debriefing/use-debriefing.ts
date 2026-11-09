"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DebriefingProduct } from "@/types/indicadores";
import type { DebriefingMetrics } from "@/lib/indicadores/service/debriefing";

export const ROTA_DEBRIEFING = "/api/indicadores/debriefing";

export function chaveDoDebriefing(startDate: string, endDate: string, produtos: DebriefingProduct[]) {
  return ["debriefing", startDate, endDate, produtos] as const;
}

async function buscar(
  startDate: string,
  endDate: string,
  produtos: DebriefingProduct[],
  signal?: AbortSignal,
): Promise<DebriefingMetrics> {
  const params = new URLSearchParams({
    products: JSON.stringify(
      produtos.map((p) => ({ product_id: p.product_id, product_name: p.product_name, offer_codes: p.offer_codes })),
    ),
    start_date: startDate,
    end_date: endDate,
  });
  const res = await fetch(`${ROTA_DEBRIEFING}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`debriefing ${res.status}`);
  return (await res.json()) as DebriefingMetrics;
}

/**
 * Vendas do Debriefing (API existente, sem mudança). `produtos` são os produtos principais do evento
 * (de `resolveDebriefingProducts`); a seleção dos chips recorta o resultado no cliente, como na V1,
 * então trocar de chip não refaz a consulta. Só consulta com `ativo` (visão Debriefing) e com produto;
 * trocar período mantém o dado anterior até o novo chegar. Sem retry automático: o erro vira estado
 * visível com "Tentar de novo".
 */
export function useDebriefing({
  startDate,
  endDate,
  produtos,
  ativo,
}: {
  startDate: string;
  endDate: string;
  produtos: DebriefingProduct[];
  ativo: boolean;
}) {
  return useQuery({
    queryKey: chaveDoDebriefing(startDate, endDate, produtos),
    queryFn: ({ signal }) => buscar(startDate, endDate, produtos, signal),
    enabled: ativo && produtos.length > 0 && Boolean(startDate) && Boolean(endDate),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
