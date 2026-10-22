import { escalaBanda, escalaLinear, marcasDeData, marcasLineares, passoRedondo } from "../charts/scales";

describe("escalaLinear", () => {
  it("mapeia o domínio na faixa e inverte", () => {
    const e = escalaLinear([0, 10], [100, 300]);
    expect(e(0)).toBe(100);
    expect(e(5)).toBe(200);
    expect(e(10)).toBe(300);
    expect(e.invert(200)).toBe(5);
  });

  it("aceita faixa invertida (eixo y do SVG)", () => {
    const e = escalaLinear([0, 100], [200, 0]);
    expect(e(0)).toBe(200);
    expect(e(100)).toBe(0);
    expect(e.range()).toEqual([200, 0]);
  });

  it("domínio de largura zero centraliza em vez de dar NaN", () => {
    const e = escalaLinear([5, 5], [0, 100]);
    expect(e(5)).toBe(50);
    expect(e.invert(10)).toBe(5);
  });

  it("nice arredonda o domínio para marcas redondas", () => {
    expect(escalaLinear([0, 97], [0, 1], { nice: true }).domain()).toEqual([0, 100]);
    expect(escalaLinear([0, 9], [0, 1], { nice: true }).domain()).toEqual([0, 10]);
  });
});

describe("marcas lineares", () => {
  it("usa passos 1, 2 ou 5 vezes uma potência de 10", () => {
    expect(passoRedondo(0, 100, 4)).toBe(20);
    expect(passoRedondo(0, 10, 5)).toBe(2);
    expect(passoRedondo(0, 1, 4)).toBe(0.2);
    expect(passoRedondo(0, 0, 4)).toBe(1);
    // Limiares: 8 está acima de √50 (vira 10) e 3,5 está acima de √10 (vira 5).
    expect(passoRedondo(0, 80, 10)).toBe(10);
    expect(passoRedondo(0, 35, 10)).toBe(5);
    expect(passoRedondo(0, 20, 10)).toBe(2);
  });

  it("gera marcas dentro do intervalo sem ruído de ponto flutuante", () => {
    expect(marcasLineares(0, 100, 4)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(marcasLineares(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(marcasLineares(-50, 50, 4)).toEqual([-40, -20, 0, 20, 40]);
    expect(marcasLineares(7, 7, 4)).toEqual([7]);
  });
});

describe("marcas de data", () => {
  const dia = (n: number) => new Date(2026, 9, 1 + n).getTime();

  it("em início de dia local, sem passar do limite de marcas", () => {
    const m = marcasDeData(dia(0), dia(29), 5);
    expect(m.length).toBeGreaterThan(1);
    expect(m.length).toBeLessThanOrEqual(5);
    for (const t of m) {
      const d = new Date(t);
      expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    }
  });

  it("escolhe passos que cabem: 30 dias em 5 marcas pula de 7 em 7", () => {
    const m = marcasDeData(dia(0), dia(29), 5);
    expect(new Date(m[1]).getDate() - new Date(m[0]).getDate()).toBe(7);
  });

  it("janela curta usa horas", () => {
    const m = marcasDeData(dia(0), dia(0) + 10 * 3_600_000, 6);
    expect(m.length).toBeGreaterThan(2);
    expect(m[1] - m[0]).toBeGreaterThanOrEqual(3_600_000);
  });

  it("um único instante não trava nem explode", () => {
    expect(marcasDeData(dia(3), dia(3), 5).length).toBeLessThanOrEqual(1);
  });
});

describe("escalaBanda", () => {
  it("divide a faixa em bandas iguais com respiro nas pontas", () => {
    const b = escalaBanda(["a", "b", "c"], [0, 300], 0.5);
    expect(b.step()).toBeCloseTo(300 / 3.5);
    expect(b.bandwidth()).toBeCloseTo(b.step() * 0.5);
    const [a, bb, c] = [b("a")!, b("b")!, b("c")!];
    expect(bb - a).toBeCloseTo(b.step());
    expect(c - bb).toBeCloseTo(b.step());
    // simétrica: sobra a mesma folga antes da primeira e depois da última banda
    expect(a).toBeCloseTo(300 - (c + b.bandwidth()));
  });

  it("id desconhecido devolve undefined e lista vazia não dá NaN", () => {
    expect(escalaBanda(["a"], [0, 100], 0.3)("x")).toBeUndefined();
    expect(Number.isFinite(escalaBanda([], [0, 100], 0.3).step())).toBe(true);
  });
});
