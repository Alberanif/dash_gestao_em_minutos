// Política de nomenclatura do ciclo (migration 053). As RPCs respondem o FATO
// — a venda bateu com um email da base ou não. Quando o ciclo declara
// counts_new_buyers = false, quem não bateu não é "novo comprador": é uma
// renovação de alguém que renovou com outro email e que não conseguimos
// atribuir.
//
// Estes dois mapeadores rodam LOGO DEPOIS do fetch e ANTES de toda a cadeia de
// derivação. É o que permite aggregateRosterKpis, filterRosterRows,
// buildRosterCsv e buildCumulativeSeries continuarem sem saber que o switch
// existe — eles recebem dados já corretos.
//
// Com counts_new_buyers = true devolvem a MESMA referência recebida (não uma
// cópia), para não invalidar memoização de quem consome.
import type { UltimatesCategory, UltimatesRosterRow } from "@/types/vendas";

// Regra sem caso especial: aprovada vira renovação sem vínculo, estornada vira
// renovação sem vínculo reembolsada. Nenhuma outra categoria é tocada.
const CATEGORY_WHEN_OFF: Partial<Record<UltimatesCategory, UltimatesCategory>> = {
  novo_comprador: "renovacao_sem_vinculo",
  novo_reembolsado: "renovacao_sem_vinculo_reembolsada",
};

export function applyNewPurchasesModeToRoster(
  rows: UltimatesRosterRow[],
  countsNewBuyers: boolean
): UltimatesRosterRow[] {
  if (countsNewBuyers) return rows;

  return rows.map((row) => {
    const remapped = CATEGORY_WHEN_OFF[row.category];
    return remapped ? { ...row, category: remapped } : row;
  });
}

// As séries do card "Evolução" passam a ter uma métrica só, então as vendas
// sem vínculo entram na curva de renovações. Zerar new_buyers (em vez de
// apagar o campo) mantém o tipo intacto e deixa quem acumula inalterado.
//
// Genérica sobre as duas contagens, e não sobre UltimatesDailyRow, porque a
// mesma regra vale para a série horária: duplicá-la seria a primeira forma de
// as duas granularidades do card discordarem entre si. O tipo de entrada volta
// intacto, então a chave temporal (`day` ou `hour`) atravessa sem ser tocada.
export function applyNewPurchasesModeToCounts<
  T extends { renewals: number; new_buyers: number }
>(rows: T[], countsNewBuyers: boolean): T[] {
  if (countsNewBuyers) return rows;

  return rows.map((row) => ({
    ...row,
    renewals: row.renewals + row.new_buyers,
    new_buyers: 0,
  }));
}
