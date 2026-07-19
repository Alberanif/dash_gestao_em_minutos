// Acúmulo no cliente das renovações diárias (PRD issue #114, seção 3.3) —
// GET /api/ultimates/cycles/[id]/daily devolve valores por dia, não
// acumulados; o gráfico precisa da soma corrente.
import type { UltimatesDailyRow } from "@/types/ultimates";

export interface CumulativeRenewalPoint {
  day: string;
  cumulative: number;
}

export function buildCumulativeSeries(days: UltimatesDailyRow[]): CumulativeRenewalPoint[] {
  // Defensivo: ordena por dia (string ISO YYYY-MM-DD, ordem lexicográfica ==
  // ordem cronológica) antes de acumular, caso a RPC não garanta ordem.
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));

  let running = 0;
  return sorted.map((d) => {
    running += d.renewals;
    return { day: d.day, cumulative: running };
  });
}
