// Vocabulário e números do modo "Apenas Compras" (migration 059, PRD). Espelha
// o padrão de new-purchases-mode.ts: funções PURAS, sem React, testáveis
// isoladamente. Rodam sobre o que as RPCs devolvem — o modo materializa cada
// venda aprovada como buyer do ciclo, então as linhas já vêm como `renovado`
// (compra) / `renovacao_reembolsada` (compra estornada); aqui só trocamos o
// rótulo e derivamos os KPIs de compra.
//
// Ambas as funções recebem a flag `purchasesOnly` e são NO-OP quando ela está
// off: o rótulo cai no padrão e a derivação devolve null (nenhuma alocação),
// para não perturbar quem consome em ciclos de renovação.
import type { UltimatesCategory, UltimatesRosterRow } from "@/types/ultimates";
import { categoryLabel } from "./format";

// Só as duas categorias que existem no modo compras são reetiquetadas. Qualquer
// outra (defensivo) cai no rótulo padrão.
const PURCHASE_CATEGORY_LABELS: Partial<Record<UltimatesCategory, string>> = {
  renovado: "Compra",
  renovacao_reembolsada: "Compra reembolsada",
};

export function purchaseCategoryLabel(
  category: UltimatesCategory,
  purchasesOnly: boolean
): string {
  if (!purchasesOnly) return categoryLabel(category);
  return PURCHASE_CATEGORY_LABELS[category] ?? categoryLabel(category);
}

export interface PurchaseKpis {
  // Compras ativas (linhas `renovado`).
  compras: number;
  // Compras estornadas (linhas `renovacao_reembolsada`) — disjuntas de `compras`.
  comprasReembolsadas: number;
  // Soma de total_value de todas as linhas. PostgREST pode serializar numeric
  // como number ou string — normalizamos aqui.
  valorTotal: number;
}

function toNumber(value: number | string | null): number {
  if (value === null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : 0;
}

// null quando o ciclo não é Apenas Compras — quem consome (KpiRow) ramifica na
// ausência e mostra os tiles de renovação. Mantém a identidade referencial do
// caso off (nenhum objeto novo é criado).
export function derivePurchaseKpis(
  rows: UltimatesRosterRow[],
  purchasesOnly: boolean
): PurchaseKpis | null {
  if (!purchasesOnly) return null;

  let compras = 0;
  let comprasReembolsadas = 0;
  let valorTotal = 0;

  for (const r of rows) {
    if (r.category === "renovado") compras += 1;
    else if (r.category === "renovacao_reembolsada") comprasReembolsadas += 1;
    valorTotal += toNumber(r.total_value);
  }

  return { compras, comprasReembolsadas, valorTotal };
}
