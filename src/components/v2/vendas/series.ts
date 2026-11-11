// Ponte entre as chaves temporais do Relatório de Vendas e o eixo x dos gráficos V2.
//
// A chave do dia ("YYYY-MM-DD") e a da hora ("YYYY-MM-DDTHH") já são hora de parede em
// America/Sao_Paulo (a RPC converte). Os gráficos V2 desenham datas pelos componentes
// LOCAIS do Date, então a chave vira um Date construído com componentes locais: o rótulo
// e as marcas do eixo mostram exatamente o dia e a hora da chave, em qualquer fuso de
// quem renderiza. Nada passa por conversão de fuso.
import type { VendasViewDailyRow, VendasViewHourlyRow } from "@/types/vendas";
import type { ChartGranularity, CumulativePoint } from "@/lib/vendas/cumulative-chart";
import { fmtDateShort, fmtHourLong, fmtHourShort } from "@/lib/vendas/format";

const dois = (n: number) => String(n).padStart(2, "0");

/** "2026-08-03" -> meio-dia local desse dia (nunca cai no dia vizinho). */
export function dataDoDia(chave: string): Date {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

/** "2026-08-03T14" -> início dessa hora, em componentes locais. */
export function dataDaHora(chave: string): Date {
  const [dia, h] = chave.split("T");
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d, Number(h));
}

/** Inverso de dataDoDia, para os formatadores do eixo. */
export function chaveDoDia(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** Inverso de dataDaHora, para os formatadores do eixo. */
export function chaveDaHora(ms: number): string {
  const d = new Date(ms);
  return `${chaveDoDia(ms)}T${dois(d.getHours())}`;
}

export interface FormatosDoEixo {
  curto: (ms: number) => string;
  longo: (ms: number) => string;
}

/** Rótulos do eixo e do balão por granularidade: "03/08" no dia; "03/08 14h" e "03/08 às 14h" na hora. */
export function formatosDoEixo(granularidade: ChartGranularity): FormatosDoEixo {
  return granularidade === "hora"
    ? { curto: (ms) => fmtHourShort(chaveDaHora(ms)), longo: (ms) => fmtHourLong(chaveDaHora(ms)) }
    : { curto: (ms) => fmtDateShort(chaveDoDia(ms)), longo: (ms) => fmtDateShort(chaveDoDia(ms)) };
}

export interface PontoDoGrafico {
  x: Date;
  y: number;
}

/** Vendas por dia ou por hora em ordem cronológica, prontas para o BarChartDiario. */
export function pontosDeVendas(
  daily: VendasViewDailyRow[],
  hourly: VendasViewHourlyRow[],
  granularidade: ChartGranularity,
): PontoDoGrafico[] {
  if (granularidade === "hora") {
    return [...hourly]
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .map((r) => ({ x: dataDaHora(r.hour), y: r.sales }));
  }
  return [...daily]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => ({ x: dataDoDia(r.day), y: r.sales }));
}

/** Acumulado (chaves cruas de buildViewDailyCumulative/Hourly) em pontos do LineChart. */
export function pontosAcumulados(pontos: CumulativePoint[], granularidade: ChartGranularity): PontoDoGrafico[] {
  const paraData = granularidade === "hora" ? dataDaHora : dataDoDia;
  return pontos.map((p) => ({ x: paraData(p.key), y: p.cumulative }));
}
