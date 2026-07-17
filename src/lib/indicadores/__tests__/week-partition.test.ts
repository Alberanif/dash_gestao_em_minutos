import { partitionWeeks } from "../week-partition";

describe("partitionWeeks", () => {
  it("particiona o exemplo do PRD (06/07 a 22/07/2026) em 3 semanas quinta→quarta", () => {
    const weeks = partitionWeeks("2026-07-06", "2026-07-22");

    expect(weeks).toEqual([
      { index: 1, startDate: "2026-07-06", endDate: "2026-07-08" },
      { index: 2, startDate: "2026-07-09", endDate: "2026-07-15" },
      { index: 3, startDate: "2026-07-16", endDate: "2026-07-22" },
    ]);
  });

  it("começa sem semana parcial quando a data inicial é uma quinta-feira", () => {
    // 02/07/2026 é quinta; 15/07 é quarta → duas semanas cheias
    const weeks = partitionWeeks("2026-07-02", "2026-07-15");

    expect(weeks).toEqual([
      { index: 1, startDate: "2026-07-02", endDate: "2026-07-08" },
      { index: 2, startDate: "2026-07-09", endDate: "2026-07-15" },
    ]);
  });

  it("gera Semana 1 parcial de 1 dia quando a data inicial é uma quarta-feira", () => {
    // 01/07/2026 é quarta → Semana 1 tem só esse dia
    const weeks = partitionWeeks("2026-07-01", "2026-07-08");

    expect(weeks).toEqual([
      { index: 1, startDate: "2026-07-01", endDate: "2026-07-01" },
      { index: 2, startDate: "2026-07-02", endDate: "2026-07-08" },
    ]);
  });

  it("gera Semana 1 parcial de 6 dias quando a data inicial é uma sexta-feira", () => {
    // 03/07/2026 é sexta → Semana 1 vai de sexta até a quarta 08/07 (6 dias)
    const weeks = partitionWeeks("2026-07-03", "2026-07-15");

    expect(weeks).toEqual([
      { index: 1, startDate: "2026-07-03", endDate: "2026-07-08" },
      { index: 2, startDate: "2026-07-09", endDate: "2026-07-15" },
    ]);
  });

  it("termina a última semana na data final mesmo antes da quarta", () => {
    // 09/07 é quinta; período termina segunda 20/07 → última semana parcial
    const weeks = partitionWeeks("2026-07-09", "2026-07-20");

    expect(weeks).toEqual([
      { index: 1, startDate: "2026-07-09", endDate: "2026-07-15" },
      { index: 2, startDate: "2026-07-16", endDate: "2026-07-20" },
    ]);
  });

  it("trata período menor que 7 dias dentro da mesma semana como uma única semana", () => {
    // sexta 10/07 a domingo 12/07 — nunca cruza uma quarta
    const weeks = partitionWeeks("2026-07-10", "2026-07-12");

    expect(weeks).toEqual([{ index: 1, startDate: "2026-07-10", endDate: "2026-07-12" }]);
  });

  it("trata período de 1 dia como uma única semana de 1 dia", () => {
    const weeks = partitionWeeks("2026-07-16", "2026-07-16");

    expect(weeks).toEqual([{ index: 1, startDate: "2026-07-16", endDate: "2026-07-16" }]);
  });

  it("cobre um período de ~90 dias sem gaps nem sobreposição", () => {
    const weeks = partitionWeeks("2026-04-15", "2026-07-13"); // 90 dias

    expect(weeks.length).toBe(14);
    expect(weeks[0].startDate).toBe("2026-04-15");
    expect(weeks[weeks.length - 1].endDate).toBe("2026-07-13");
    for (let i = 1; i < weeks.length; i++) {
      const prevEnd = new Date(`${weeks[i - 1].endDate}T00:00:00Z`).getTime();
      const nextStart = new Date(`${weeks[i].startDate}T00:00:00Z`).getTime();
      expect(nextStart - prevEnd).toBe(24 * 60 * 60 * 1000);
    }
    // semanas intermediárias são sempre quinta→quarta cheias
    for (const week of weeks.slice(1, -1)) {
      expect(new Date(`${week.startDate}T00:00:00Z`).getUTCDay()).toBe(4);
      expect(new Date(`${week.endDate}T00:00:00Z`).getUTCDay()).toBe(3);
    }
  });

  it("devolve vazio para intervalo invertido", () => {
    expect(partitionWeeks("2026-07-22", "2026-07-06")).toEqual([]);
  });
});
