import { buildCumulativeSeries } from "../cumulative-chart";
import type { UltimatesDailyRow } from "@/types/ultimates";

describe("buildCumulativeSeries", () => {
  it("retorna vazio para entrada vazia", () => {
    expect(buildCumulativeSeries([])).toEqual([]);
  });

  it("acumula a soma corrente por dia", () => {
    const days: UltimatesDailyRow[] = [
      { day: "2026-07-01", renewals: 3 },
      { day: "2026-07-02", renewals: 5 },
      { day: "2026-07-03", renewals: 0 },
      { day: "2026-07-04", renewals: 2 },
    ];
    expect(buildCumulativeSeries(days)).toEqual([
      { day: "2026-07-01", cumulative: 3 },
      { day: "2026-07-02", cumulative: 8 },
      { day: "2026-07-03", cumulative: 8 },
      { day: "2026-07-04", cumulative: 10 },
    ]);
  });

  it("ordena por dia (string ISO) antes de acumular, mesmo se a entrada vier fora de ordem", () => {
    const days: UltimatesDailyRow[] = [
      { day: "2026-07-03", renewals: 1 },
      { day: "2026-07-01", renewals: 4 },
      { day: "2026-07-02", renewals: 2 },
    ];
    expect(buildCumulativeSeries(days)).toEqual([
      { day: "2026-07-01", cumulative: 4 },
      { day: "2026-07-02", cumulative: 6 },
      { day: "2026-07-03", cumulative: 7 },
    ]);
  });

  it("não muta o array de entrada", () => {
    const days: UltimatesDailyRow[] = [{ day: "2026-07-02", renewals: 1 }, { day: "2026-07-01", renewals: 1 }];
    const copy = [...days];
    buildCumulativeSeries(days);
    expect(days).toEqual(copy);
  });
});
