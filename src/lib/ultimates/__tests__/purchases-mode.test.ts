import {
  purchaseCategoryLabel,
  derivePurchaseKpis,
  countPurchasesForEmail,
} from "../purchases-mode";
import { categoryLabel } from "../format";
import type { UltimatesRosterRow } from "@/types/ultimates";

// No modo Apenas Compras toda linha é um buyer materializado (buyer_id
// preenchido) que caiu como renovado (compra aprovada) ou
// renovacao_reembolsada (compra estornada).
function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: "2026-07-10T00:00:00Z",
    total_value: 100,
    transaction_code: "tx1",
    ...overrides,
  };
}

describe("purchaseCategoryLabel", () => {
  it("reetiqueta renovado como 'Compra' no modo Apenas Compras", () => {
    expect(purchaseCategoryLabel("renovado", true)).toBe("Compra");
  });

  it("reetiqueta renovacao_reembolsada como 'Compra reembolsada' no modo Apenas Compras", () => {
    expect(purchaseCategoryLabel("renovacao_reembolsada", true)).toBe("Compra reembolsada");
  });

  it("com a flag off, cai no rótulo padrão (identidade de comportamento)", () => {
    expect(purchaseCategoryLabel("renovado", false)).toBe(categoryLabel("renovado"));
    expect(purchaseCategoryLabel("renovacao_reembolsada", false)).toBe(
      categoryLabel("renovacao_reembolsada")
    );
  });

  it("cai no rótulo padrão para categorias fora do vocabulário de compras", () => {
    expect(purchaseCategoryLabel("nao_renovado", true)).toBe(categoryLabel("nao_renovado"));
  });
});

describe("derivePurchaseKpis", () => {
  it("devolve null quando a flag está off (nada a derivar)", () => {
    const rows = [row({ category: "renovado" })];
    expect(derivePurchaseKpis(rows, false)).toBeNull();
  });

  it("conta Compras (renovado), Compras reembolsadas (renovacao_reembolsada) e soma Valor total", () => {
    const rows = [
      row({ email: "a@x.com", category: "renovado", total_value: 100 }),
      row({ email: "b@x.com", category: "renovado", total_value: 250 }),
      row({ email: "c@x.com", category: "renovacao_reembolsada", total_value: 0 }),
    ];
    expect(derivePurchaseKpis(rows, true)).toEqual({
      compras: 2,
      comprasReembolsadas: 1,
      valorTotal: 350,
    });
  });

  it("trata total_value null como zero e numeric-como-string do PostgREST", () => {
    const rows = [
      row({ email: "a@x.com", category: "renovado", total_value: null }),
      row({ email: "b@x.com", category: "renovado", total_value: "97.5" as unknown as number }),
    ];
    expect(derivePurchaseKpis(rows, true)).toEqual({
      compras: 2,
      comprasReembolsadas: 0,
      valorTotal: 97.5,
    });
  });

  it("devolve zeros para roster vazio quando a flag está on", () => {
    expect(derivePurchaseKpis([], true)).toEqual({
      compras: 0,
      comprasReembolsadas: 0,
      valorTotal: 0,
    });
  });
});

// Com a lista por venda (migration 064) o mesmo email ocupa uma linha por
// compra. Estes dois travam a contagem POR LINHA contra uma regressão futura
// que voltasse a deduplicar por comprador.
describe("derivePurchaseKpis — uma linha por venda", () => {
  it("conta as duas compras do mesmo email como duas", () => {
    const rows = [
      row({ email: "tati@x.com", category: "renovado", total_value: 100, transaction_code: "T1" }),
      row({ email: "tati@x.com", category: "renovado", total_value: 250, transaction_code: "T2" }),
    ];

    const kpis = derivePurchaseKpis(rows, true);

    expect(kpis).toEqual({ compras: 2, comprasReembolsadas: 0, valorTotal: 350 });
  });

  it("separa compra aprovada de compra estornada do mesmo email", () => {
    const rows = [
      row({ email: "tati@x.com", category: "renovado", total_value: 100, transaction_code: "T1" }),
      row({
        email: "tati@x.com",
        category: "renovacao_reembolsada",
        total_value: null,
        transaction_code: "T2",
      }),
    ];

    const kpis = derivePurchaseKpis(rows, true);

    expect(kpis).toEqual({ compras: 1, comprasReembolsadas: 1, valorTotal: 100 });
  });
});

describe("countPurchasesForEmail", () => {
  it("conta as linhas do mesmo email, ignorando caixa e espaços de borda", () => {
    const rows = [
      row({ email: "Tati@X.com ", transaction_code: "T1" }),
      row({ email: "tati@x.com", transaction_code: "T2" }),
      row({ email: "outro@x.com", transaction_code: "T3" }),
    ];

    expect(countPurchasesForEmail(rows, "tati@x.com")).toBe(2);
  });

  it("devolve 0 para email ausente", () => {
    expect(countPurchasesForEmail([], "ninguem@x.com")).toBe(0);
  });
});
