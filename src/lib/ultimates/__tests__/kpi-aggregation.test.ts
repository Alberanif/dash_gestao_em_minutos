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
      renovacoesSemVinculo: 0,
      renovacoesSemVinculoReembolsadas: 0,
      possivelmenteRenovados: 0,
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

describe("aggregateRosterKpis — renovações sem vínculo (counts_new_buyers = false)", () => {
  it("soma renovacao_sem_vinculo em renovados sem inflar a base", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovado" }),
      row({ buyer_id: "b2", category: "nao_renovado" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.renovados).toBe(2);
    expect(kpis.renovacoesSemVinculo).toBe(1);
    expect(kpis.base).toBe(2);
  });

  it("soma renovacao_sem_vinculo_reembolsada em renovacaoReembolsada", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovacao_reembolsada" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo_reembolsada" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.renovacaoReembolsada).toBe(2);
    expect(kpis.renovacoesSemVinculoReembolsadas).toBe(1);
  });

  it("reembolsada sem vínculo NÃO entra em renovados", () => {
    const rows = [row({ buyer_id: null, category: "renovacao_sem_vinculo_reembolsada" })];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.renovados).toBe(0);
    expect(kpis.renovacoesSemVinculo).toBe(0);
  });

  it("permite percentual acima de 100% — é sinal de premissa errada, não bug", () => {
    const rows = [
      row({ buyer_id: "b1", category: "renovado" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.base).toBe(1);
    expect(kpis.renovados).toBe(3);
    expect(kpis.renovadosPercent).toBeCloseTo(300, 5);
  });

  it("possivelmenteRenovados é o mínimo entre sem-vínculo aprovadas e não renovados", () => {
    const rows = [
      row({ buyer_id: "b1", category: "nao_renovado" }),
      row({ buyer_id: "b2", category: "nao_renovado" }),
      row({ buyer_id: "b3", category: "nao_renovado" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
    ];
    expect(aggregateRosterKpis(rows).possivelmenteRenovados).toBe(2);
  });

  it("possivelmenteRenovados satura em naoRenovados quando há mais sem-vínculo que não renovados", () => {
    const rows = [
      row({ buyer_id: "b1", category: "nao_renovado" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
      row({ buyer_id: null, category: "renovacao_sem_vinculo" }),
    ];
    expect(aggregateRosterKpis(rows).possivelmenteRenovados).toBe(1);
  });

  it("zera os campos novos quando o ciclo admite novas compras", () => {
    const rows = [
      row({ buyer_id: null, category: "novo_comprador" }),
      row({ buyer_id: null, category: "novo_reembolsado" }),
    ];
    const kpis = aggregateRosterKpis(rows);
    expect(kpis.renovacoesSemVinculo).toBe(0);
    expect(kpis.renovacoesSemVinculoReembolsadas).toBe(0);
    expect(kpis.possivelmenteRenovados).toBe(0);
    expect(kpis.novosCompradores).toBe(2);
  });
});
