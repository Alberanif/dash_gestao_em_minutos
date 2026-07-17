/**
 * Particiona um período em semanas quinta-feira → quarta-feira (decisão do PRD
 * da Planilha). As pontas podem ser parciais: a Semana 1 vai de startDate até a
 * primeira quarta; a última termina em endDate. Todo dia do período pertence a
 * exatamente uma semana.
 *
 * Datas são strings YYYY-MM-DD no calendário BRT do dashboard — a conversão
 * para UTC das queries continua a cargo de `timezone.ts`.
 */
export interface WeekSlice {
  index: number;
  startDate: string;
  endDate: string;
}

const WEDNESDAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function partitionWeeks(startDate: string, endDate: string): WeekSlice[] {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) return [];

  const weeks: WeekSlice[] = [];
  let cursor = startMs;
  while (cursor <= endMs) {
    const daysUntilWednesday = (WEDNESDAY - new Date(cursor).getUTCDay() + 7) % 7;
    const weekEnd = Math.min(cursor + daysUntilWednesday * DAY_MS, endMs);
    weeks.push({
      index: weeks.length + 1,
      startDate: toDateStr(cursor),
      endDate: toDateStr(weekEnd),
    });
    cursor = weekEnd + DAY_MS;
  }
  return weeks;
}
