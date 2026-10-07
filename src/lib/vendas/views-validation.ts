import { parseDateRange } from "@/lib/vendas/date-range";

// Validação de entrada das rotas /api/vendas/views. Pura (sem I/O) para as rotas
// de POST e PATCH aplicarem exatamente as mesmas regras do CHECK do banco
// (dash_gestao_vendas_offer_codes_valid): >= 1 oferta, sem vazio, sem duplicado.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseOfferCodes(raw: unknown): Parsed<string[]> {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "offer_codes deve ser um array" };
  }
  const codes: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      return { ok: false, error: "offer_codes deve conter apenas textos" };
    }
    const code = item.trim();
    if (code.length === 0) {
      return { ok: false, error: "offer_codes não pode conter código vazio" };
    }
    if (codes.includes(code)) {
      return { ok: false, error: `Oferta duplicada: ${code}` };
    }
    codes.push(code);
  }
  if (codes.length === 0) {
    return { ok: false, error: "Selecione ao menos uma oferta" };
  }
  return { ok: true, value: codes };
}

/** null = limpar. Par SEMPRE junto (mesma regra do CHECK chk_vendas_views_range). */
export function parseViewPeriod(
  start: unknown,
  end: unknown
): Parsed<{ view_start_date: string | null; view_end_date: string | null }> {
  if (start === undefined || end === undefined) {
    return { ok: false, error: "view_start_date e view_end_date devem vir juntos" };
  }
  if (start === null && end === null) {
    return { ok: true, value: { view_start_date: null, view_end_date: null } };
  }
  const range =
    typeof start === "string" && typeof end === "string" ? parseDateRange(start, end) : null;
  if (range === null || Number.isNaN(Date.parse(`${range.start}T00:00:00Z`)) ||
      Number.isNaN(Date.parse(`${range.end}T00:00:00Z`))) {
    return {
      ok: false,
      error: "Período inválido: use YYYY-MM-DD com fim >= início, ou null nos dois",
    };
  }
  return { ok: true, value: { view_start_date: range.start, view_end_date: range.end } };
}

export function parseFolderId(raw: unknown): Parsed<string | null> {
  if (raw === null || raw === "") return { ok: true, value: null };
  if (typeof raw === "string") return { ok: true, value: raw.trim() || null };
  return { ok: false, error: "folder_id inválido" };
}
