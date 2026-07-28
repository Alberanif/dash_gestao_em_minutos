// Acúmulo no cliente das contagens diárias (PRD issue #114, seção 3.3) —
// GET /api/ultimates/cycles/[id]/daily devolve valores por dia, não
// acumulados; o gráfico precisa da soma corrente.
import type { UltimatesDailyRow } from "@/types/ultimates";

// Séries alternáveis pelo switch do card "Evolução".
export type UltimatesSeries = "renovacoes" | "novos";

export interface CumulativeRenewalPoint {
  day: string;
  cumulative: number;
}

// Uma série por chamada, sobre o MESMO conjunto de dias: a RPC (migration
// 051) agrega as duas contagens juntas, então dias em que a série pedida não
// teve nada continuam presentes como patamar plano. É isso que faz os dois
// gráficos serem comparáveis ponto a ponto ao alternar o switch.
export function buildCumulativeSeries(
  days: UltimatesDailyRow[],
  series: UltimatesSeries = "renovacoes"
): CumulativeRenewalPoint[] {
  // Defensivo: ordena por dia (string ISO YYYY-MM-DD, ordem lexicográfica ==
  // ordem cronológica) antes de acumular, caso a RPC não garanta ordem.
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));

  let running = 0;
  return sorted.map((d) => {
    running += (series === "novos" ? d.new_buyers : d.renewals) ?? 0;
    return { day: d.day, cumulative: running };
  });
}
