// Formatadores do Debriefing V2. Copiados da V1 (que não é alterada).
// O Intl pt-BR usa espaço não separável (NBSP) entre "R$" e o número;
// trocamos por espaço comum para o valor poder quebrar/caber no celular.

const SEM_NBSP = /[  ]/g;

export function fmtBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(SEM_NBSP, " ");
}

export function fmtNum(n: number): string {
  return Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
    .format(n)
    .replace(SEM_NBSP, " ");
}

/** "2026-10-07" -> "07/10" */
export function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
