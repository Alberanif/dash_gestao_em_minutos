const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const fmtBRL = (n: number) => brl.format(n);
export const fmtNum = (n: number) => inteiro.format(n);

/** Decimal pt-BR; `null` vira "—", nunca "0". */
export function fmtDecimal(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export const fmtPct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${fmtDecimal(n, 2)}%`);
