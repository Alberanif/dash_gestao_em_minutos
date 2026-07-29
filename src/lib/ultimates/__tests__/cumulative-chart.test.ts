import { buildCumulativeSeries } from "../cumulative-chart";
import type { UltimatesDailyRow } from "@/types/ultimates";

function day(day: string, renewals: number, new_buyers = 0): UltimatesDailyRow {
  return { day, renewals, new_buyers };
}

describe("buildCumulativeSeries", () => {
  it("retorna vazio para entrada vazia", () => {
    expect(buildCumulativeSeries([])).toEqual([]);
  });

  it("acumula a soma corrente por dia", () => {
    const days: UltimatesDailyRow[] = [
      day("2026-07-01", 3),
      day("2026-07-02", 5),
      day("2026-07-03", 0),
      day("2026-07-04", 2),
    ];
    expect(buildCumulativeSeries(days)).toEqual([
      { day: "2026-07-01", cumulative: 3 },
      { day: "2026-07-02", cumulative: 8 },
      { day: "2026-07-03", cumulative: 8 },
      { day: "2026-07-04", cumulative: 10 },
    ]);
  });

  it("ordena por dia (string ISO) antes de acumular, mesmo se a entrada vier fora de ordem", () => {
    const days: UltimatesDailyRow[] = [day("2026-07-03", 1), day("2026-07-01", 4), day("2026-07-02", 2)];
    expect(buildCumulativeSeries(days)).toEqual([
      { day: "2026-07-01", cumulative: 4 },
      { day: "2026-07-02", cumulative: 6 },
      { day: "2026-07-03", cumulative: 7 },
    ]);
  });

  it("não muta o array de entrada", () => {
    const days: UltimatesDailyRow[] = [day("2026-07-02", 1), day("2026-07-01", 1)];
    const copy = [...days];
    buildCumulativeSeries(days);
    expect(days).toEqual(copy);
  });

  it("acumula new_buyers quando a série pedida é 'novos'", () => {
    const days: UltimatesDailyRow[] = [
      day("2026-07-01", 3, 1),
      day("2026-07-02", 5, 0),
      day("2026-07-03", 0, 4),
    ];
    expect(buildCumulativeSeries(days, "novos")).toEqual([
      { day: "2026-07-01", cumulative: 1 },
      { day: "2026-07-02", cumulative: 1 },
      { day: "2026-07-03", cumulative: 5 },
    ]);
  });

  it("mantém o mesmo eixo de dias nas duas séries (dia sem a métrica vira patamar plano)", () => {
    const days: UltimatesDailyRow[] = [
      day("2026-07-01", 2, 0),
      day("2026-07-02", 0, 3), // só novos compradores neste dia
      day("2026-07-03", 1, 1),
    ];
    const renovacoes = buildCumulativeSeries(days, "renovacoes");
    const novos = buildCumulativeSeries(days, "novos");

    expect(renovacoes.map((p) => p.day)).toEqual(novos.map((p) => p.day));
    expect(renovacoes.map((p) => p.cumulative)).toEqual([2, 2, 3]);
    expect(novos.map((p) => p.cumulative)).toEqual([0, 3, 4]);
  });

  // Guarda de runtime: se alguma linha chegar sem a contagem, o acúmulo não
  // pode virar NaN — um único NaN apaga o eixo Y do gráfico inteiro.
  it("trata a contagem ausente como zero, sem virar NaN", () => {
    const days = [
      { day: "2026-07-01", renewals: 2 },
      { day: "2026-07-02", renewals: 1 },
    ] as unknown as UltimatesDailyRow[];

    expect(buildCumulativeSeries(days, "novos")).toEqual([
      { day: "2026-07-01", cumulative: 0 },
      { day: "2026-07-02", cumulative: 0 },
    ]);
  });
});
