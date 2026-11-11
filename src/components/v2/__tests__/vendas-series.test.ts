import {
  chaveDaHora,
  chaveDoDia,
  dataDaHora,
  dataDoDia,
  formatosDoEixo,
  pontosAcumulados,
  pontosDeVendas,
} from "../vendas/series";

// Os gráficos desenham datas pelos componentes locais do Date. Estes testes cobrem a
// tradução chave-crua -> rótulo, que o jsdom não deixa observar no SVG: trocar o formatador
// de hora pelo de dia deixaria o eixo lendo lixo plausível com a suíte verde.
describe("vendas/series: chaves e datas", () => {
  it("o dia vira meio-dia local e volta para a mesma chave", () => {
    const d = dataDoDia("2026-08-03");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 7, 3, 12]);
    expect(chaveDoDia(d.getTime())).toBe("2026-08-03");
  });

  it("a hora vira o início da hora local e volta para a mesma chave", () => {
    const d = dataDaHora("2026-08-03T00");
    expect([d.getDate(), d.getHours()]).toEqual([3, 0]);
    expect(chaveDaHora(d.getTime())).toBe("2026-08-03T00");
    expect(chaveDaHora(dataDaHora("2026-12-31T23").getTime())).toBe("2026-12-31T23");
  });

  it("virada de mês e de ano não desloca o dia", () => {
    expect(chaveDoDia(dataDoDia("2026-12-31").getTime())).toBe("2026-12-31");
    expect(chaveDoDia(dataDoDia("2026-03-01").getTime())).toBe("2026-03-01");
  });
});

describe("vendas/series: rótulos por granularidade", () => {
  const dia = dataDoDia("2026-08-03").getTime();
  const hora = dataDaHora("2026-08-03T14").getTime();

  it("dia: dd/mm no eixo e no balão", () => {
    const f = formatosDoEixo("dia");
    expect(f.curto(dia)).toBe("03/08");
    expect(f.longo(dia)).toBe("03/08");
  });

  it("hora: 'dd/mm HHh' no eixo e 'dd/mm às HHh' no balão", () => {
    const f = formatosDoEixo("hora");
    expect(f.curto(hora)).toBe("03/08 14h");
    expect(f.longo(hora)).toBe("03/08 às 14h");
  });

  it("não confunde os dois formatadores entre si", () => {
    expect(formatosDoEixo("hora").curto(hora)).not.toBe(formatosDoEixo("dia").curto(hora));
  });
});

describe("vendas/series: pontos dos gráficos", () => {
  const daily = [
    { day: "2026-08-02", sales: 4 },
    { day: "2026-08-01", sales: 3 },
  ];
  const hourly = [
    { hour: "2026-08-01T12", sales: 4 },
    { hour: "2026-08-01T10", sales: 1 },
  ];

  it("vendas por dia saem em ordem cronológica, mesmo que a RPC não ordene", () => {
    const p = pontosDeVendas(daily, hourly, "dia");
    expect(p.map((x) => chaveDoDia(x.x.getTime()))).toEqual(["2026-08-01", "2026-08-02"]);
    expect(p.map((x) => x.y)).toEqual([3, 4]);
  });

  it("vendas por hora usam a série horária, em ordem", () => {
    const p = pontosDeVendas(daily, hourly, "hora");
    expect(p.map((x) => chaveDaHora(x.x.getTime()))).toEqual(["2026-08-01T10", "2026-08-01T12"]);
    expect(p.map((x) => x.y)).toEqual([1, 4]);
  });

  it("o acumulado converte a chave de cada granularidade para o Date certo", () => {
    const dia = pontosAcumulados([{ key: "2026-08-01", cumulative: 3 }, { key: "2026-08-02", cumulative: 7 }], "dia");
    expect(dia.map((x) => chaveDoDia(x.x.getTime()))).toEqual(["2026-08-01", "2026-08-02"]);
    expect(dia.map((x) => x.y)).toEqual([3, 7]);

    const hora = pontosAcumulados([{ key: "2026-08-01T10", cumulative: 1 }], "hora");
    expect(chaveDaHora(hora[0].x.getTime())).toBe("2026-08-01T10");
  });
});
