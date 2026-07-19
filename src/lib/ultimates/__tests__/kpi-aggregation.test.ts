import { aggregateRosterKpis } from "../kpi-aggregation";
import type { UltimatesRosterRow } from "@/types/ultimates";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

describe("aggregateRosterKpis", () => {
  it("lida com roster vazio sem NaN", () => {
    const kpis = aggregateRosterKpis([]);
    expect(kpis).toEqual({
      base: 0,
      renovados: 0,
      renovadosPercent: 0,
      renovacaoReembolsada: 0,
      naoRenovados: 0,
      novosCompradores: 0,
      novosReembolsados: 0,
    });
  });

  it("calcula base como linhas com buyer_id != null (exclui novos compradores)", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovado" }),
      row({ buyer_id: "b2", category: "nao_renovado" }),
      row({ buyer_id: null, category: "novo_comprador" }),
    ];
    expect(aggregateRosterKpis(rows).base).toBe(2);
  });

  it("conta renovados e calcula % sobre a base, 1 casa decimal implícita no número", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovado" }),
      row({ buyer_id: "b2", category: "renovado" }),
      row({ buyer_id: "b3", category: "nao_renovado" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.renovados).toBe(2);
    expect(kpis.base).toBe(3);
    expect(kpis.renovadosPercent).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("conta renovação reembolsada e não renovados separadamente da base de renovados", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovacao_reembolsada" }),
      row({ buyer_id: "b2", category: "nao_renovado" }),
      row({ buyer_id: "b3", category: "nao_renovado" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.renovacaoReembolsada).toBe(1);
    expect(kpis.naoRenovados).toBe(2);
    expect(kpis.renovados).toBe(0);
  });

  it("soma novo_comprador + novo_reembolsado em novosCompradores, com novosReembolsados destacado", () => {
    const rows = [
      row({ buyer_id: null, category: "novo_comprador" }),
      row({ buyer_id: null, category: "novo_comprador" }),
      row({ buyer_id: null, category: "novo_reembolsado" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.novosCompradores).toBe(3);
    expect(kpis.novosReembolsados).toBe(1);
  });

  it("renovadosPercent é 0 (não NaN) quando a base é 0 mas há novos compradores", () => {
    const rows = [row({ buyer_id: null, category: "novo_comprador" })];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.base).toBe(0);
    expect(kpis.renovadosPercent).toBe(0);
  });
});
