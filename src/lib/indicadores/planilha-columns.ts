/**
 * Decisão pura de quais blocos da Planilha aparecem. Em evento orgânico não
 * há vendas, receita, ROAS nem CPA (PRD #242, seção 4.4): somem os blocos
 * "Vendas por origem" e "Resumo" (ROAS, Receita, Total de Vendas). Meta Ads
 * (investimento, leads, CPM...) e Leads por origem permanecem.
 */
export interface PlanilhaBlocks {
  meta: boolean;
  leads: boolean;
  vendas: boolean;
  resumo: boolean;
}

export function planilhaBlocksFor(isOrganic: boolean): PlanilhaBlocks {
  return { meta: true, leads: true, vendas: !isOrganic, resumo: !isOrganic };
}
