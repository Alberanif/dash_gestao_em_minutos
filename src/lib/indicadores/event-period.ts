const DATA = /^\d{4}-\d{2}-\d{2}$/;

const dataValida = (d: unknown): d is string =>
  typeof d === "string" && DATA.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

export type PeriodoDoEvento = { start_date: string | null; end_date: string | null };

export type ResultadoPeriodo = { ok: true; value: PeriodoDoEvento } | { ok: false; error: string };

/**
 * Período do evento: início e fim juntos ou nenhum dos dois. Vazio ("" ou null) vira null.
 * Data impossível, só um dos lados ou início depois do fim são recusados.
 */
export function validateEventPeriod(start: unknown, end: unknown): ResultadoPeriodo {
  const vazio = (v: unknown) => v === undefined || v === null || v === "";
  if (vazio(start) && vazio(end)) return { ok: true, value: { start_date: null, end_date: null } };
  if (vazio(start) || vazio(end)) {
    return { ok: false, error: "Informe a data de início e a de fim do evento." };
  }
  if (!dataValida(start) || !dataValida(end)) {
    return { ok: false, error: "As datas do evento devem estar no formato AAAA-MM-DD." };
  }
  if (start > end) return { ok: false, error: "A data de início não pode ser depois da data de fim." };
  return { ok: true, value: { start_date: start, end_date: end } };
}
