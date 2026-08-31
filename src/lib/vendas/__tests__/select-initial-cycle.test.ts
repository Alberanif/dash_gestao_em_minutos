import { selectInitialCycleId } from "../select-initial-cycle";

describe("selectInitialCycleId", () => {
  it("retorna null quando não há ciclos", () => {
    expect(selectInitialCycleId([])).toBeNull();
  });

  it("seleciona o ciclo ativo mais recente, mesmo quando não é o primeiro da lista", () => {
    // Contrato de GET /api/vendas/cycles: lista ordenada por created_at desc.
    const cycles = [
      { id: "c3", status: "encerrado" as const }, // mais recente, mas encerrado
      { id: "c2", status: "ativo" as const }, // ativo mais recente
      { id: "c1", status: "ativo" as const },
    ];
    expect(selectInitialCycleId(cycles)).toBe("c2");
  });

  it("cai no ciclo mais recente (mesmo encerrado) quando não há nenhum ativo", () => {
    const cycles = [
      { id: "c2", status: "encerrado" as const },
      { id: "c1", status: "encerrado" as const },
    ];
    expect(selectInitialCycleId(cycles)).toBe("c2");
  });

  it("com um único ciclo ativo, seleciona ele mesmo", () => {
    const cycles = [{ id: "only", status: "ativo" as const }];
    expect(selectInitialCycleId(cycles)).toBe("only");
  });
});
