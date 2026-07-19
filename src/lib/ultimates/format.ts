// Formatters pt-BR do Dash Ultimates (PRD issue #114). Assinatura seguindo o
// padrão do repo (conventions.md seção 9: Intl.NumberFormat("pt-BR", ...),
// "—" como placeholder de valor ausente — nunca "-", "N/A" ou vazio).
import type { UltimatesCategory } from "@/types/ultimates";

export function fmtBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function fmtPercent1(n: number): string {
  return `${Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n)}%`;
}

// dd/mm/aaaa a partir de componentes UTC — deliberado: usar
// toLocaleDateString() com o timezone do servidor/navegador deslocaria a
// data exibida perto da meia-noite (approved_date é timestamptz). Extrair os
// componentes em UTC mantém a data estável independente de onde o código
// roda.
export function fmtDateFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// "2026-05-01" -> "01/05" (mesmo padrão de trend-charts.tsx:fmtDate) — o dia
// da RPC daily já vem como date puro (YYYY-MM-DD), sem componente de hora,
// então split direto é seguro (sem Date/timezone envolvidos).
export function fmtDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const CATEGORY_LABELS: Record<UltimatesCategory, string> = {
  renovado: "Renovado",
  nao_renovado: "Não renovado",
  renovacao_reembolsada: "Renovação reembolsada",
  novo_comprador: "Novo Comprador",
  novo_reembolsado: "Novo — reembolsado",
};

export function categoryLabel(category: UltimatesCategory): string {
  return CATEGORY_LABELS[category];
}
