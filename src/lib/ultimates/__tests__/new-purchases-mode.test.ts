import {
  applyNewPurchasesModeToRoster,
  applyNewPurchasesModeToDaily,
} from "../new-purchases-mode";
import type { UltimatesDailyRow, UltimatesRosterRow } from "@/types/ultimates";

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

describe("applyNewPurchasesModeToDaily", () => {
  it("é identidade quando o ciclo admite novas compras", () => {
    expect(applyNewPurchasesModeToDaily(DAYS, true)).toBe(DAYS);
  });

  it("soma new_buyers em renewals e zera new_buyers", () => {
    expect(applyNewPurchasesModeToDaily(DAYS, false)).toEqual([
      { day: "2026-07-01", renewals: 2, new_buyers: 0 },
      { day: "2026-07-02", renewals: 3, new_buyers: 0 },
    ]);
  });

  it("preserva o eixo de dias — nenhum dia entra ou sai", () => {
    const out = applyNewPurchasesModeToDaily(DAYS, false);
    expect(out.map((d) => d.day)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("não muta o array de entrada", () => {
    const days: UltimatesDailyRow[] = [{ day: "2026-07-02", renewals: 0, new_buyers: 3 }];
    applyNewPurchasesModeToDaily(days, false);
    expect(days[0]).toEqual({ day: "2026-07-02", renewals: 0, new_buyers: 3 });
  });

  it("lida com lista vazia", () => {
    expect(applyNewPurchasesModeToDaily([], false)).toEqual([]);
  });
});
