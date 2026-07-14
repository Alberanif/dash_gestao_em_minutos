/**
 * As datas do dashboard são BRT (UTC-3); `purchase_date` na Hotmart é UTC.
 * Um erro nesta conversão desloca vendas de um dia para o outro, em silêncio.
 */
export function brtToUtc(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${dateStr}${time}-03:00`).toISOString();
}

/** Volta um timestamp UTC para a data BRT correspondente (YYYY-MM-DD). */
export function utcToBrtDate(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
