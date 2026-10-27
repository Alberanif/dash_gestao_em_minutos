import type { FilterRecord } from "@/types/indicadores";
import { brtToUtc, utcToBrtDate } from "./timezone";

/** Data de hoje em Brasília (AAAA-MM-DD). */
export function hojeBrt(agora: Date = new Date()): string {
  return utcToBrtDate(agora.toISOString());
}

/** O evento vence à meia-noite seguinte ao `end_date`: no próprio dia de fim ele ainda está ativo. */
export function eventoVencido(endDate: string | null | undefined, hoje: string = hojeBrt()): boolean {
  return Boolean(endDate) && (endDate as string) < hoje;
}

/**
 * Status calculado na leitura, sem gravar nada: um evento `ativo` com data de fim passada
 * vira `finalizado`, com `status_changed_at` no fim do dia do `end_date`. Cancelado e
 * finalizado à mão ficam como estão; sem `end_date` o evento nunca finaliza sozinho.
 * `status_automatico` marca o que veio daqui, para a edição não regravar esse status.
 */
export function aplicarStatusAutomatico(filter: FilterRecord, agora: Date = new Date()): FilterRecord {
  if (filter.status !== "ativo" || !eventoVencido(filter.end_date, hojeBrt(agora))) return filter;
  return {
    ...filter,
    status: "finalizado",
    status_changed_at: brtToUtc(filter.end_date as string, true),
    status_automatico: true,
  };
}
