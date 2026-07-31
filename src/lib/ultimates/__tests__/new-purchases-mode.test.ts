import {
  applyNewPurchasesModeToRoster,
  applyNewPurchasesModeToCounts,
} from "../new-purchases-mode";
import type { UltimatesDailyRow, UltimatesHourlyRow, UltimatesRosterRow } from "@/types/ultimates";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: null,
    name: null,
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "novo_comprador",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

const DAYS: UltimatesDailyRow[] = [
  { day: "2026-07-01", renewals: 2, new_buyers: 0 },
  { day: "2026-07-02", renewals: 0, new_buyers: 3 },
];

describe("applyNewPurchasesModeToRoster", () => {
  it("é identidade quando o ciclo admite novas compras", () => {
    const rows = [row({ category: "novo_comprador" }), row({ category: "novo_reembolsado" })];
    expect(applyNewPurchasesModeToRoster(rows, true)).toBe(rows);
  });

  it("reetiqueta novo_comprador como renovacao_sem_vinculo", () => {
    const out = applyNewPurchasesModeToRoster([row({ category: "novo_comprador" })], false);
    expect(out[0].category).toBe("renovacao_sem_vinculo");
  });

  it("reetiqueta novo_reembolsado como renovacao_sem_vinculo_reembolsada", () => {
    const out = applyNewPurchasesModeToRoster([row({ category: "novo_reembolsado" })], false);
    expect(out[0].category).toBe("renovacao_sem_vinculo_reembolsada");
  });

  it("não toca em linhas da base", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovado" }),
      row({ buyer_id: "b2", category: "nao_renovado" }),
      row({ buyer_id: "b3", category: "renovacao_reembolsada" }),
    ];
    const out = applyNewPurchasesModeToRoster(rows, false);
    expect(out.map((r) => r.category)).toEqual([
      "renovado",
      "nao_renovado",
      "renovacao_reembolsada",
    ]);
  });

  it("preserva os demais campos da linha reetiquetada", () => {
    const original = row({ category: "novo_comprador", email: "a@b.com", total_value: 97 });
    const out = applyNewPurchasesModeToRoster([original], false);
    expect(out[0]).toEqual({ ...original, category: "renovacao_sem_vinculo" });
  });

  it("não muta o array de entrada", () => {
    const rows = [row({ category: "novo_comprador" })];
    applyNewPurchasesModeToRoster(rows, false);
    expect(rows[0].category).toBe("novo_comprador");
  });

  it("lida com lista vazia", () => {
    expect(applyNewPurchasesModeToRoster([], false)).toEqual([]);
  });
});

describe("applyNewPurchasesModeToCounts", () => {
  it("é identidade referencial quando o ciclo admite novas compras", () => {
    // O useMemo do dashboard depende disso: uma cópia nova invalidaria a
    // memoização a cada render.
    expect(applyNewPurchasesModeToCounts(DAYS, true)).toBe(DAYS);
  });

  it("soma new_buyers em renewals e zera new_buyers quando o ciclo não admite novas compras", () => {
    expect(applyNewPurchasesModeToCounts(DAYS, false)).toEqual([
      { day: "2026-07-01", renewals: 2, new_buyers: 0 },
      { day: "2026-07-02", renewals: 3, new_buyers: 0 },
    ]);
  });

  it("não muta o array de entrada", () => {
    const copy = DAYS.map((d) => ({ ...d }));
    applyNewPurchasesModeToCounts(DAYS, false);
    expect(DAYS).toEqual(copy);
  });

  it("devolve vazio para entrada vazia", () => {
    expect(applyNewPurchasesModeToCounts([] as UltimatesDailyRow[], false)).toEqual([]);
  });

  // A mesma função serve a série horária — a regra do modo não pode existir
  // em dois lugares, senão as duas visões do card divergem.
  it("aplica a mesma regra a linhas horárias, preservando a chave `hour`", () => {
    const hours: UltimatesHourlyRow[] = [
      { hour: "2026-07-01T20", renewals: 1, new_buyers: 4 },
      { hour: "2026-07-01T21", renewals: 2, new_buyers: 0 },
    ];

    expect(applyNewPurchasesModeToCounts(hours, false)).toEqual([
      { hour: "2026-07-01T20", renewals: 5, new_buyers: 0 },
      { hour: "2026-07-01T21", renewals: 2, new_buyers: 0 },
    ]);
  });
});
