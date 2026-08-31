import { buildCumulativeSeries, buildHourlyCumulativeSeries } from "../cumulative-chart";
import type { UltimatesDailyRow, UltimatesHourlyRow } from "@/types/vendas";

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

  // Gêmeo do teste homônimo da série horária: as duas curvas dividem o mesmo
  // card e o mesmo modo de falhar. Number(...) em daily/route.ts vira NaN para
  // valor não-numérico, e `?? 0` deixa passar porque NaN não é null/undefined.
  it("trata NaN na contagem como zero, sem propagar para cumulative", () => {
    const days = [
      { day: "2026-07-01", renewals: NaN, new_buyers: 1 },
      { day: "2026-07-02", renewals: 2, new_buyers: NaN },
    ] as unknown as UltimatesDailyRow[];

    expect(buildCumulativeSeries(days, "renovacoes")).toEqual([
      { key: "2026-07-01", cumulative: 0 },
      { key: "2026-07-02", cumulative: 2 },
    ]);
    expect(buildCumulativeSeries(days, "novos")).toEqual([
      { key: "2026-07-01", cumulative: 1 },
      { key: "2026-07-02", cumulative: 1 },
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

  // `inicioMs` só serve para deixar a aritmética do índice->vão explícita nos
  // comentários abaixo; as chaves de fixture e de expectativa são strings
  // literais, não geradas por uma função de formatação — se fossem geradas
  // pela mesma fórmula de `msParaHora` (produção), uma regressão nela (ex.:
  // `getUTCHours` virar `getHours`) moveria fixture e expectativa juntas, e
  // o teste continuaria passando sem detectar nada.
  const HORA_MS = 3_600_000;
  const inicioMs = Date.UTC(2026, 6, 1, 0); // 2026-07-01T00

  // Teto defensivo: um vão maior que TETO_HORAS_PREENCHIDAS (8760h = 1 ano)
  // degrada para o comportamento da curva diária — só os pontos recebidos,
  // acumulados, sem preencher o intervalo. Vão de 8761 horas (índice
  // 0..8760, ou seja de 2026-07-01T00 a 2027-07-01T00) ultrapassa o teto.
  it("acima do teto de horas, devolve só os pontos recebidos acumulados, sem preencher", () => {
    expect(inicioMs + 8760 * HORA_MS).toBe(Date.UTC(2027, 6, 1, 0));
    const hours = [hour("2026-07-01T00", 4), hour("2027-07-01T00", 1)];

    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T00", cumulative: 4 },
      { key: "2027-07-01T00", cumulative: 5 },
    ]);
  });

  // Mesmo teto, do outro lado: vão de exatamente 8760 horas (índice
  // 0..8759, de 2026-07-01T00 a 2027-06-30T23) ainda preenche normalmente —
  // o teto não pode disparar cedo demais, e precisa cobrir com folga o ciclo
  // de 6 meses (~4300 pontos horários) que o spec (Risco #1) já dá como
  // pesado, mas não recusa.
  it("no teto exato de 8760 horas, ainda preenche normalmente", () => {
    expect(inicioMs + 8759 * HORA_MS).toBe(Date.UTC(2027, 5, 30, 23));
    const hours = [hour("2026-07-01T00", 4), hour("2027-06-30T23", 1)];

    const pontos = buildHourlyCumulativeSeries(hours);
    expect(pontos).toHaveLength(8760);
    expect(pontos[0]).toEqual({ key: "2026-07-01T00", cumulative: 4 });
    expect(pontos[pontos.length - 1]).toEqual({ key: "2027-06-30T23", cumulative: 5 });
    // patamar plano no meio do intervalo, prova de que o preenchimento rodou
    expect(pontos[1]).toEqual({ key: "2026-07-01T01", cumulative: 4 });
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

  // Vão invertido: uma hora não replicada com zero à esquerda ("T9" em vez de
  // "T09") ordena DEPOIS de "T10" na comparação lexicográfica (sorted[]),
  // mas é cronologicamente ANTES. Isso faz `fim` (calculado da última
  // posição do array ordenado) ficar menor que `inicio` — `vaoHoras` sai
  // negativo, não é `> TETO`, e sem a guarda `vaoHoras < 1` a primeira
  // comparação do loop de preenchimento já começaria falsa, devolvendo []
  // mesmo com dados válidos (o mesmo sintoma do finding do `hour` malformado).
  it("vão invertido (lexicográfico diverge de cronológico) devolve os pontos recebidos, não []", () => {
    const hours = [hour("2026-07-01T10", 2), hour("2026-07-01T9", 1)];

    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T10", cumulative: 2 },
      { key: "2026-07-01T9", cumulative: 3 },
    ]);
  });

  // O modo de falha mais perigoso do módulo: as contagens são indexadas pela
  // string CRUA da RPC e relidas por uma chave REGERADA por msParaHora(). Se o
  // to_char da migration 054 derivar do formato combinado — aqui, hora sem
  // zero à esquerda —, as duas pontas ainda parseiam, o vão sai válido, e todo
  // lookup do preenchimento erra em silêncio: a curva inteira vira zero e o
  // card anuncia "Sem renovações registradas no ciclo ainda.". Uma falha de
  // encanamento vestida de resposta de negócio. A guarda de round-trip
  // (`contagens.has(msParaHora(inicio))`) derruba o preenchimento para o
  // fallback honesto, que preserva as contagens recebidas.
  it("formato de hora divergente (sem zero à esquerda) preserva as contagens em vez de zerar a curva", () => {
    const hours = [hour("2026-07-01T8", 1), hour("2026-07-01T9", 2)];

    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T8", cumulative: 1 },
      { key: "2026-07-01T9", cumulative: 3 },
    ]);
  });

  // Mesma classe de deriva, outra forma: hora completa (HH:MM:SS) no lugar de
  // HH. Esta já não parseia, então cai no fallback pela guarda de NaN — o
  // teste existe para fixar que as duas derivas terminam no MESMO lugar, e
  // nenhuma delas em uma série zerada.
  it("formato de hora divergente (HH:MM:SS) também preserva as contagens", () => {
    const hours = [hour("2026-07-01T08:00:00", 1), hour("2026-07-01T09:00:00", 2)];

    expect(buildHourlyCumulativeSeries(hours)).toEqual([
      { key: "2026-07-01T08:00:00", cumulative: 1 },
      { key: "2026-07-01T09:00:00", cumulative: 3 },
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

describe("recorte por intervalo de datas", () => {
  const DIAS: UltimatesDailyRow[] = [
    day("2026-07-08", 5, 1),
    day("2026-07-10", 2, 3),
    day("2026-07-15", 4, 0),
    day("2026-07-25", 9, 9),
  ];

  it("range null mantém o comportamento de hoje", () => {
    expect(buildCumulativeSeries(DIAS, "renovacoes", null)).toEqual(
      buildCumulativeSeries(DIAS, "renovacoes")
    );
  });

  it("acumula do zero dentro do intervalo, ignorando o que veio antes", () => {
    const pontos = buildCumulativeSeries(DIAS, "renovacoes", {
      start: "2026-07-10",
      end: "2026-07-20",
    });
    // 08/07 (5) fica de fora e NÃO entra como saldo inicial: a curva responde
    // "quanto entrou no período".
    expect(pontos).toEqual([
      { key: "2026-07-10", cumulative: 2 },
      { key: "2026-07-15", cumulative: 6 },
    ]);
  });

  it("inclui as duas pontas do intervalo", () => {
    const pontos = buildCumulativeSeries(DIAS, "novos", {
      start: "2026-07-08",
      end: "2026-07-10",
    });
    expect(pontos.map((p) => p.key)).toEqual(["2026-07-08", "2026-07-10"]);
    expect(pontos[1].cumulative).toBe(4);
  });

  it("intervalo sem nenhum dia devolve lista vazia", () => {
    expect(
      buildCumulativeSeries(DIAS, "renovacoes", { start: "2026-06-01", end: "2026-06-30" })
    ).toEqual([]);
  });

  it("recorta a série horária pela parte de data da chave", () => {
    const horas: UltimatesHourlyRow[] = [
      { hour: "2026-07-09T23", renewals: 7, new_buyers: 0 },
      { hour: "2026-07-10T00", renewals: 1, new_buyers: 0 },
      { hour: "2026-07-10T02", renewals: 2, new_buyers: 0 },
    ];
    const pontos = buildHourlyCumulativeSeries(horas, "renovacoes", {
      start: "2026-07-10",
      end: "2026-07-10",
    });
    // 23h do dia 09 fica fora; as horas vazias entre 00h e 02h continuam sendo
    // preenchidas como patamar.
    expect(pontos).toEqual([
      { key: "2026-07-10T00", cumulative: 1 },
      { key: "2026-07-10T01", cumulative: 1 },
      { key: "2026-07-10T02", cumulative: 3 },
    ]);
  });

  it("intervalo sem nenhuma hora devolve lista vazia", () => {
    const horas: UltimatesHourlyRow[] = [{ hour: "2026-07-09T23", renewals: 7, new_buyers: 0 }];
    expect(
      buildHourlyCumulativeSeries(horas, "renovacoes", { start: "2026-07-10", end: "2026-07-10" })
    ).toEqual([]);
  });
});
