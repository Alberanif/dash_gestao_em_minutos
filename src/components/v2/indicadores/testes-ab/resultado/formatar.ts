const TZ = "America/Sao_Paulo";

export function pct(x: number | null | undefined, casas = 1): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${(x * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function num(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : Number(n).toLocaleString("pt-BR");
}

/** Data (sem hora) no fuso de São Paulo. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { timeZone: TZ });
}

/** "2026-10-05" (dia já no fuso de SP) -> "05/10". */
export function diaCurto(dia: string): string {
  const p = String(dia).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : String(dia);
}

/** "2026-10-05" -> meio-dia local do mesmo dia: o gráfico formata em hora local sem escorregar de dia. */
export function diaParaData(dia: string): Date {
  const [a, m, d] = String(dia).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12);
}

export function textoHoras(h: number | null | undefined): string {
  if (h == null) return "";
  if (h < 1) return "há menos de 1 hora";
  if (h < 48) return `há ${Math.round(h)} h`;
  return `há ${Math.round(h / 24)} dias`;
}
