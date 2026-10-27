import {
  AMOSTRA_MINIMA,
  CONFIANCA_MINIMA,
  amostraNecessaria,
  compararVariantes,
  pValorBicaudal,
} from "../estatistica";

const perto = (a: number, b: number, tol: number) => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
};

describe("estatistica", () => {
  it("expõe os limiares", () => {
    expect(CONFIANCA_MINIMA).toBe(0.95);
    expect(AMOSTRA_MINIMA).toBe(100);
  });

  it("p-valor bicaudal bate com a tabela normal (e é simétrico)", () => {
    perto(pValorBicaudal(1.959964), 0.05, 1e-5);
    perto(pValorBicaudal(-1.959964), 0.05, 1e-5);
    perto(pValorBicaudal(1.644854), 0.1, 1e-5);
    perto(pValorBicaudal(2.575829), 0.01, 1e-5);
    perto(pValorBicaudal(0), 1, 1e-9);
  });

  it("amostra necessária: 5% vs 6% (~8.150 por variante); iguais dão Infinity", () => {
    const n = amostraNecessaria(0.05, 0.06);
    expect(n).toBeGreaterThan(8100);
    expect(n).toBeLessThan(8200);
    expect(amostraNecessaria(0.06, 0.05)).toBe(n);
    expect(amostraNecessaria(0.05, 0.05)).toBe(Infinity);
  });

  it("2,0% vs 2,5% com 10 mil visitantes: vencedor, p ≈ 0,017", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 10000, leads: 200 },
      { id: "b", controle: false, visitantes: 10000, leads: 250 },
    ]);
    const b = r.variantes[1];
    perto(b.p_valor as number, 0.0171, 5e-4);
    perto(b.confianca as number, 0.983, 5e-4);
    perto(b.diferenca_abs as number, 0.005, 1e-9);
    perto(b.diferenca_rel as number, 0.25, 1e-9);
    expect(b.veredito).toBe("vencedor");
    expect(r.veredito).toBe("vencedor");
    expect(r.vencedor_id).toBe("b");
    expect(r.controle_id).toBe("a");
    expect(r.confianca_minima).toBe(0.95);
    expect(r.amostra_minima).toBe(100);
    const a = r.variantes[0];
    expect(a.veredito).toBeNull();
    expect(a.p_valor).toBeNull();
    expect(a.faltam).toBeNull();
    expect(a.diferenca_abs).toBeNull();
  });

  it("variante pior que o controle de forma significativa é perdedora, sem vencedor", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 10000, leads: 250 },
      { id: "b", controle: false, visitantes: 10000, leads: 200 },
    ]);
    expect(r.variantes[1].veredito).toBe("perdedor");
    expect((r.variantes[1].diferenca_abs as number) < 0).toBe(true);
    expect((r.variantes[1].diferenca_rel as number) < 0).toBe(true);
    expect(r.veredito).toBe("sem_diferenca");
    expect(r.vencedor_id).toBeNull();
  });

  it("diferença pequena com amostra grande: sem diferença e faltam visitantes", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 1000, leads: 50 },
      { id: "b", controle: false, visitantes: 1000, leads: 55 },
    ]);
    const b = r.variantes[1];
    expect(b.veredito).toBe("sem_diferenca");
    expect(b.faltam as number).toBeGreaterThan(0);
    expect(b.amostra_necessaria as number).toBeGreaterThan(1000);
    expect(b.faltam).toBe((b.amostra_necessaria as number) - 1000);
  });

  it("amostra pequena: cedo demais, mesmo com diferença grande", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 40, leads: 2 },
      { id: "b", controle: false, visitantes: 40, leads: 12 },
    ]);
    expect(r.variantes[1].veredito).toBe("cedo_demais");
    expect(r.veredito).toBe("cedo_demais");
    expect(r.variantes[1].faltam as number).toBeGreaterThan(0);
  });

  it("limite da amostra mínima: 99 é cedo demais, 100 já decide", () => {
    const com = (n: number) =>
      compararVariantes([
        { id: "a", controle: true, visitantes: n, leads: 0 },
        { id: "b", controle: false, visitantes: n, leads: 50 },
      ]).variantes[1].veredito;
    expect(com(99)).toBe("cedo_demais");
    expect(com(100)).toBe("vencedor");
  });

  it("limite da confiança: p abaixo de 0,05 vence; acima é sem diferença", () => {
    const variante = (k: number) =>
      compararVariantes([
        { id: "a", controle: true, visitantes: 1000, leads: 50 },
        { id: "b", controle: false, visitantes: 1000, leads: 50 + k },
      ]).variantes[1];
    const abaixo = variante(23);
    const acima = variante(20);
    expect(abaixo.p_valor as number).toBeLessThan(0.05);
    expect(abaixo.veredito).toBe("vencedor");
    expect(acima.p_valor as number).toBeGreaterThan(0.05);
    expect(acima.veredito).toBe("sem_diferenca");
  });

  it("empate exato: p = 1, confiança 0, sem diferença", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 500, leads: 20 },
      { id: "b", controle: false, visitantes: 500, leads: 20 },
    ]);
    const b = r.variantes[1];
    expect(b.p_valor).toBe(1);
    expect(b.confianca).toBe(0);
    expect(b.diferenca_abs).toBe(0);
    expect(b.veredito).toBe("sem_diferenca");
  });

  it("zeros: ninguém converteu (erro padrão 0) dá p = 1, sem NaN", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 500, leads: 0 },
      { id: "b", controle: false, visitantes: 500, leads: 0 },
    ]);
    expect(r.variantes[1].p_valor).toBe(1);
    expect(r.variantes[1].diferenca_rel).toBeNull();
    expect(r.variantes[1].veredito).toBe("sem_diferenca");
  });

  it("zeros: todos converteram (erro padrão 0) dá p = 1", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 500, leads: 500 },
      { id: "b", controle: false, visitantes: 500, leads: 500 },
    ]);
    expect(r.variantes[1].p_valor).toBe(1);
    expect(r.variantes[1].veredito).toBe("sem_diferenca");
  });

  it("zeros: sem visitantes não gera NaN e fica cedo demais", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 0, leads: 0 },
      { id: "b", controle: false, visitantes: 0, leads: 0 },
    ]);
    const b = r.variantes[1];
    expect(b.taxa).toBe(0);
    expect(b.p_valor).toBeNull();
    expect(b.confianca).toBeNull();
    expect(b.veredito).toBe("cedo_demais");
    for (const k of ["taxa", "diferenca_abs", "faltam", "amostra_necessaria"] as const) {
      expect(Number.isFinite(b[k])).toBe(true);
    }
  });

  it("controle zerado: diferença relativa nula e variante vence", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 500, leads: 0 },
      { id: "b", controle: false, visitantes: 500, leads: 20 },
    ]);
    expect(r.variantes[1].diferenca_rel).toBeNull();
    expect(r.variantes[1].veredito).toBe("vencedor");
    expect(Number.isFinite(r.variantes[1].amostra_necessaria)).toBe(true);
  });

  it("sanitiza entrada: negativos e leads maiores que visitantes", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: -5, leads: 3 },
      { id: "b", controle: false, visitantes: 10, leads: 50 },
    ]);
    expect(r.variantes[0].visitantes).toBe(0);
    expect(r.variantes[0].leads).toBe(0);
    expect(r.variantes[1].leads).toBe(10);
    expect(r.variantes[1].taxa).toBe(1);
  });

  it("sem controle marcado, a primeira variante é o controle", () => {
    const r = compararVariantes([
      { id: "x", visitantes: 10, leads: 1 },
      { id: "y", visitantes: 10, leads: 1 },
    ]);
    expect(r.controle_id).toBe("x");
    expect(r.variantes[0].controle).toBe(false);
    expect(r.variantes[0].veredito).toBeNull();
    expect(r.variantes[1].veredito).not.toBeNull();
  });

  it("3 variantes: compara cada uma com o controle, avisa e escolhe a de maior taxa", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 10000, leads: 200 },
      { id: "b", controle: false, visitantes: 10000, leads: 250 },
      { id: "c", controle: false, visitantes: 10000, leads: 300 },
    ]);
    expect(r.avisos).toHaveLength(1);
    expect(r.vencedor_id).toBe("c");
    expect(r.variantes[1].veredito).toBe("vencedor");
    const r2 = compararVariantes([
      { id: "a", controle: true, visitantes: 10000, leads: 200 },
      { id: "c", controle: false, visitantes: 10000, leads: 300 },
      { id: "b", controle: false, visitantes: 10000, leads: 250 },
    ]);
    expect(r2.vencedor_id).toBe("c");
  });

  it("veredito geral: uma variante cedo demais, sem vencedor, mantém cedo demais", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 10000, leads: 200 },
      { id: "b", controle: false, visitantes: 10000, leads: 200 },
      { id: "c", controle: false, visitantes: 20, leads: 1 },
    ]);
    expect(r.veredito).toBe("cedo_demais");
  });

  it("amostra necessária com taxas zero não vira NaN", () => {
    expect(amostraNecessaria(0, 0)).toBe(Infinity);
  });

  it("estimativa de amostra: efeito mínimo de 20% relativo sobre o controle", () => {
    // observado 5% vs 5,1% -> usa efeito de 20% do controle (5% -> 6%)
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 10000, leads: 500 },
      { id: "b", controle: false, visitantes: 10000, leads: 510 },
    ]);
    expect(r.variantes[1].amostra_necessaria).toBe(amostraNecessaria(0.05, 0.06));
  });

  it("estimativa de amostra: controle sem leads assume base de 1%", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 500, leads: 0 },
      { id: "b", controle: false, visitantes: 500, leads: 20 },
    ]);
    // efeito = max(4%, 0,2%) = 4% -> 1% vs 5%, nunca abaixo da amostra mínima
    expect(r.variantes[1].amostra_necessaria).toBe(Math.max(100, amostraNecessaria(0.01, 0.05)));
  });

  it("faltam usa a menor das duas amostras", () => {
    const r = compararVariantes([
      { id: "a", controle: true, visitantes: 1000, leads: 50 },
      { id: "b", controle: false, visitantes: 3000, leads: 165 },
    ]);
    const b = r.variantes[1];
    expect(b.faltam).toBe((b.amostra_necessaria as number) - 1000);
  });

  it("menos de 2 variantes não quebra e avisa", () => {
    const vazio = compararVariantes([]);
    expect(vazio.veredito).toBe("cedo_demais");
    expect(vazio.controle_id).toBeNull();
    expect(vazio.avisos).toHaveLength(1);
    expect(compararVariantes(null).variantes).toEqual([]);
    const r = compararVariantes([{ id: "a", controle: true, visitantes: 10, leads: 1 }]);
    expect(r.veredito).toBe("cedo_demais");
    expect(r.avisos).toHaveLength(1);
  });
});
