import {
  caminhoBarra,
  cleanPoints,
  etapasFunil,
  foldTail,
  formatarPercentual,
  nearestIndex,
  passoFunil,
  xDomain,
  yDomain,
} from "../charts/geometry";
import { corFunil, corSerie } from "../charts/palette";

describe("cleanPoints", () => {
  it("descarta NaN e infinitos e ordena por x", () => {
    const out = cleanPoints([
      { x: 3, y: 30 },
      { x: 1, y: NaN },
      { x: 2, y: 20 },
      { x: Infinity, y: 5 },
      { x: new Date(0), y: 7 },
    ]);
    expect(out).toEqual([
      { x: 0, y: 7 },
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ]);
  });
});

describe("nearestIndex", () => {
  const xs = [0, 10, 20, 40];
  it("acha o vizinho mais próximo, inclusive nas pontas", () => {
    expect(nearestIndex(xs, -5)).toBe(0);
    expect(nearestIndex(xs, 4)).toBe(0);
    expect(nearestIndex(xs, 6)).toBe(1);
    expect(nearestIndex(xs, 29)).toBe(2);
    expect(nearestIndex(xs, 31)).toBe(3);
    expect(nearestIndex(xs, 999)).toBe(3);
  });
  it("funciona com um único ponto", () => {
    expect(nearestIndex([5], 100)).toBe(0);
  });
});

describe("domínios", () => {
  it("y parte do zero quando tudo é positivo e nunca tem altura nula", () => {
    expect(yDomain([5, 9])).toEqual([0, 9]);
    expect(yDomain([4, 4])).toEqual([0, 4]);
    expect(yDomain([0, 0])).toEqual([0, 1]);
    expect(yDomain([])).toEqual([0, 1]);
  });
  it("y com negativos mantém o mínimo", () => {
    expect(yDomain([-3, 5])).toEqual([-3, 5]);
    expect(yDomain([-3, -1])).toEqual([-3, 0]);
  });
  it("x com um único ponto ganha folga dos dois lados", () => {
    expect(xDomain([10], 1)).toEqual([9, 11]);
    expect(xDomain([10, 20], 1)).toEqual([10, 20]);
  });
});

describe("foldTail", () => {
  const itens = [
    { id: "a", label: "A", value: 50 },
    { id: "b", label: "B", value: 30 },
    { id: "c", label: "C", value: 10 },
    { id: "d", label: "D", value: 6 },
    { id: "e", label: "E", value: 3 },
    { id: "f", label: "F", value: 1 },
  ];
  it("não mexe quando cabe", () => {
    expect(foldTail(itens.slice(0, 3), 5)).toHaveLength(3);
  });
  it("funde a cauda em Outros somando os valores e mantém a ordem original", () => {
    const out = foldTail(itens, 5);
    expect(out.map((i) => i.id)).toEqual(["a", "b", "c", "d", "__outros"]);
    expect(out[4].value).toBe(3 + 1);
    expect(out.reduce((s, i) => s + i.value, 0)).toBe(100);
  });
  it("ignora valores zerados ou inválidos", () => {
    expect(foldTail([{ id: "x", label: "X", value: 0 }, { id: "y", label: "Y", value: NaN }], 5)).toEqual([]);
  });
});

describe("etapasFunil", () => {
  it("calcula conversão do total e da etapa anterior", () => {
    const e = etapasFunil([1000, 400, 100]);
    expect(e[0]).toEqual({ pctDoTotal: 1, pctDaAnterior: null });
    expect(e[1]).toEqual({ pctDoTotal: 0.4, pctDaAnterior: 0.4 });
    expect(e[2].pctDoTotal).toBeCloseTo(0.1);
    expect(e[2].pctDaAnterior).toBeCloseTo(0.25);
  });
  it("divisão por zero vira 0, nunca NaN", () => {
    const e = etapasFunil([0, 0, 5]);
    expect(e.every((x) => Number.isFinite(x.pctDoTotal))).toBe(true);
    expect(e[2].pctDaAnterior).toBe(0);
  });
});

describe("passoFunil", () => {
  it("espalha as etapas pela rampa de 5 passos, sem sair dela", () => {
    expect([0, 1, 2, 3, 4].map((i) => passoFunil(i, 5))).toEqual([1, 2, 3, 4, 5]);
    expect([0, 1, 2].map((i) => passoFunil(i, 3))).toEqual([1, 3, 5]);
    expect(passoFunil(0, 1)).toBe(1);
    expect(Math.max(...Array.from({ length: 9 }, (_, i) => passoFunil(i, 9)))).toBe(5);
  });
});

describe("caminhoBarra", () => {
  it("arredonda só a ponta do dado: topo de coluna, base reta", () => {
    const d = caminhoBarra(0, 0, 20, 50, 4, "topo");
    expect(d).toContain("Q0,0 4,0");
    expect(d).toContain("Q20,0 20,4");
    expect(d.startsWith("M0,50")).toBe(true);
  });
  it("raio nunca passa da metade da barra", () => {
    expect(caminhoBarra(0, 0, 6, 2, 4, "topo")).toContain("Q0,0 1,0");
  });
  it("barra de altura zero não gera NaN", () => {
    expect(caminhoBarra(0, 10, 20, 0, 4, "topo")).not.toContain("NaN");
  });
});

describe("formatarPercentual", () => {
  it("usa pt-BR", () => {
    expect(formatarPercentual(0.1234)).toBe("12,3%");
  });
});

describe("palette", () => {
  it("as cinco primeiras séries seguem a ordem fixa e a sexta é a ardósia, nunca uma cor nova", () => {
    expect([0, 1, 2, 3, 4].map(corSerie)).toEqual([
      "var(--v2-serie-1)",
      "var(--v2-serie-2)",
      "var(--v2-serie-3)",
      "var(--v2-serie-4)",
      "var(--v2-serie-5)",
    ]);
    expect(corSerie(5)).toBe("var(--v2-ardosia)");
    expect(corSerie(40)).toBe("var(--v2-ardosia)");
  });
  it("o funil fica dentro da rampa de 5 passos", () => {
    expect(corFunil(0)).toBe("var(--v2-funil-1)");
    expect(corFunil(9)).toBe("var(--v2-funil-5)");
  });
});
