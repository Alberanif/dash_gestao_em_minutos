import { buildCumulativeSeries, buildHourlyCumulativeSeries } from "../cumulative-chart";
import type { UltimatesDailyRow, UltimatesHourlyRow } from "@/types/ultimates";

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
      { key: "2026-07-01", cumulative: 3 },
      { key: "2026-07-02", cumulative: 8 },
      { key: "2026-07-03", cumulative: 8 },
      { key: "2026-07-04", cumulative: 10 },
    ]);
  });

  it("ordena por dia (string ISO) antes de acumular, mesmo se a entrada vier fora de ordem", () => {
    const days: UltimatesDailyRow[] = [day("2026-07-03", 1), day("2026-07-01", 4), day("2026-07-02", 2)];
    expect(buildCumulativeSeries(days)).toEqual([
      { key: "2026-07-01", cumulative: 4 },
      { key: "2026-07-02", cumulative: 6 },
      { key: "2026-07-03", cumulative: 7 },
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
      { key: "2026-07-01", cumulative: 1 },
      { key: "2026-07-02", cumulative: 1 },
      { key: "2026-07-03", cumulative: 5 },
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

    expect(renovacoes.map((p) => p.key)).toEqual(novos.map((p) => p.key));
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
      { key: "2026-07-01", cumulative: 0 },
      { key: "2026-07-02", cumulative: 0 },
    ]);
  });
});

function hour(hour: string, renewals: number, new_buyers = 0): UltimatesHourlyRow {
  return { hour, renewals, new_buyers };
}

describe("buildHourlyCumulativeSeries", () => {
  it("retorna vazio para entrada vazia", () => {
    expect(buildHourlyCumulativeSeries([])).toEqual([]);
  });

  it("acumula a soma corrente por hora", () => {
    const hours = [hour("2026-07-01T10", 2), hour("2026-07-01T11", 3)];
    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T10", cumulative: 2 },
      { key: "2026-07-01T11", cumulative: 5 },
    ]);
  });

  // O ponto da feature: uma madrugada sem venda tem que ocupar o eixo, senão
  // a inclinação da curva mente sobre o ritmo.
  it("preenche as horas sem venda como patamar plano", () => {
    const hours = [hour("2026-07-01T02", 4), hour("2026-07-01T06", 1)];
    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T02", cumulative: 4 },
      { key: "2026-07-01T03", cumulative: 4 },
      { key: "2026-07-01T04", cumulative: 4 },
      { key: "2026-07-01T05", cumulative: 4 },
      { key: "2026-07-01T06", cumulative: 5 },
    ]);
  });

  it("atravessa a virada de dia", () => {
    const hours = [hour("2026-07-01T23", 1), hour("2026-07-02T01", 2)];
    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T23", cumulative: 1 },
      { key: "2026-07-02T00", cumulative: 1 },
      { key: "2026-07-02T01", cumulative: 3 },
    ]);
  });

  it("atravessa a virada de mês", () => {
    const hours = [hour("2026-07-31T23", 1), hour("2026-08-01T00", 1)];
    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-31T23", cumulative: 1 },
      { key: "2026-08-01T00", cumulative: 2 },
    ]);
  });

  it("ordena antes de acumular, mesmo se a entrada vier fora de ordem", () => {
    const hours = [hour("2026-07-01T12", 1), hour("2026-07-01T10", 4)];
    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T10", cumulative: 4 },
      { key: "2026-07-01T11", cumulative: 4 },
      { key: "2026-07-01T12", cumulative: 5 },
    ]);
  });

  it("não muta o array de entrada", () => {
    const hours = [hour("2026-07-01T12", 1), hour("2026-07-01T10", 1)];
    const copy = hours.map((h) => ({ ...h }));
    buildHourlyCumulativeSeries(hours);
    expect(hours).toEqual(copy);
  });

  it("acumula new_buyers quando a série pedida é 'novos', sobre o mesmo eixo de horas", () => {
    const hours = [hour("2026-07-01T10", 2, 1), hour("2026-07-01T12", 0, 3)];
    const renovacoes = buildHourlyCumulativeSeries(hours, "renovacoes");
    const novos = buildHourlyCumulativeSeries(hours, "novos");

    expect(renovacoes.map((p) => p.key)).toEqual(novos.map((p) => p.key));
    expect(renovacoes.map((p) => p.cumulative)).toEqual([2, 2, 2]);
    expect(novos.map((p) => p.cumulative)).toEqual([1, 1, 4]);
  });

  // Guarda de runtime: um único NaN apaga o eixo Y do gráfico inteiro.
  it("trata a contagem ausente como zero, sem virar NaN", () => {
    const hours = [
      { hour: "2026-07-01T10", renewals: 2 },
      { hour: "2026-07-01T11", renewals: 1 },
    ] as unknown as UltimatesHourlyRow[];

    expect(buildHourlyCumulativeSeries(hours, "novos")).toEqual([
      { key: "2026-07-01T10", cumulative: 0 },
      { key: "2026-07-01T11", cumulative: 0 },
    ]);
  });

  // Defensivo: a RPC agrupa por hora, então duplicata não deveria existir —
  // mas somar é a única resposta que não perde venda.
  it("soma duplicatas da mesma hora em vez de descartá-las", () => {
    const hours = [hour("2026-07-01T10", 2), hour("2026-07-01T10", 3)];
    expect(buildHourlyCumulativeSeries(hours)).toEqual([{ key: "2026-07-01T10", cumulative: 5 }]);
  });

  // Converte epoch ms -> "YYYY-MM-DDTHH" com getters UTC, espelhando
  // msParaHora do próprio módulo, só para montar fixtures de vão largo sem
  // contar datas de calendário na mão.
  function horaDeMs(ms: number): string {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const h = String(d.getUTCHours()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}`;
  }
  const HORA_MS = 3_600_000;
  const inicioMs = Date.UTC(2026, 6, 1, 0);

  // Teto defensivo: um vão maior que TETO_HORAS_PREENCHIDAS (2000h) degrada
  // para o comportamento da curva diária — só os pontos recebidos,
  // acumulados, sem preencher o intervalo. Vão de 2001 horas (índice 0..2000)
  // ultrapassa o teto de 2000.
  it("acima do teto de horas, devolve só os pontos recebidos acumulados, sem preencher", () => {
    const fimMs = inicioMs + 2000 * HORA_MS; // índice 0..2000 => vão de 2001 horas
    const hours = [hour(horaDeMs(inicioMs), 4), hour(horaDeMs(fimMs), 1)];

    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: horaDeMs(inicioMs), cumulative: 4 },
      { key: horaDeMs(fimMs), cumulative: 5 },
    ]);
  });

  // Mesmo teto, do outro lado: vão de exatamente 2000 horas (índice 0..1999)
  // ainda preenche normalmente — o teto não pode disparar cedo demais.
  it("no teto exato de 2000 horas, ainda preenche normalmente", () => {
    const fimMs = inicioMs + 1999 * HORA_MS; // índice 0..1999 => vão de exatamente 2000 horas
    const hours = [hour(horaDeMs(inicioMs), 4), hour(horaDeMs(fimMs), 1)];

    const pontos = buildHourlyCumulativeSeries(hours);
    expect(pontos).toHaveLength(2000);
    expect(pontos[0]).toEqual({ key: horaDeMs(inicioMs), cumulative: 4 });
    expect(pontos[pontos.length - 1]).toEqual({ key: horaDeMs(fimMs), cumulative: 5 });
    // patamar plano no meio do intervalo, prova de que o preenchimento rodou
    expect(pontos[1]).toEqual({ key: horaDeMs(inicioMs + HORA_MS), cumulative: 4 });
  });

  // Guarda de runtime: Number(...) na rota vira NaN para valor não-numérico,
  // e `?? 0` deixa passar porque NaN não é null/undefined. Um único NaN apaga
  // o eixo Y inteiro no Recharts.
  it("trata NaN na contagem como zero, sem propagar para cumulative", () => {
    const hours = [
      { hour: "2026-07-01T10", renewals: NaN, new_buyers: 1 },
      { hour: "2026-07-01T11", renewals: 2, new_buyers: NaN },
    ] as unknown as UltimatesHourlyRow[];

    expect(buildHourlyCumulativeSeries(hours, "renovacoes")).toEqual([
      { key: "2026-07-01T10", cumulative: 0 },
      { key: "2026-07-01T11", cumulative: 2 },
    ]);
    expect(buildHourlyCumulativeSeries(hours, "novos")).toEqual([
      { key: "2026-07-01T10", cumulative: 1 },
      { key: "2026-07-01T11", cumulative: 1 },
    ]);
  });

  // Uma chave `hour` malformada na última linha não pode derrubar a série
  // inteira: antes do fix, `fim` virava NaN, a primeira comparação do loop
  // era falsa, e a função devolvia [] mesmo com dados válidos no meio.
  it("hour malformado na última linha devolve os pontos recebidos, não []", () => {
    const hours = [hour("2026-07-01T10", 2), hour("2026-07-01T11", 1), hour("zzzz-invalida", 3)];

    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T10", cumulative: 2 },
      { key: "2026-07-01T11", cumulative: 3 },
      { key: "zzzz-invalida", cumulative: 6 },
    ]);
  });
});
