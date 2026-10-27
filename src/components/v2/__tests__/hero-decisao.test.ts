import { decidirModo, dispositivoFraco, fpsAlvo, limiteDpr, type Ambiente } from "../evento/hero-decisao";

const BOM: Ambiente = { reducedMotion: false, webgl: true, fraco: false, abaOculta: false, naTela: true, contextoPerdido: false };

describe("decidirModo", () => {
  it("roda o WebGL quando o ambiente permite", () => {
    expect(decidirModo(BOM)).toBe("webgl-rodando");
  });
  it.each([
    ["movimento reduzido", { reducedMotion: true }],
    ["sem WebGL", { webgl: false }],
    ["dispositivo fraco", { fraco: true }],
    ["contexto perdido", { contextoPerdido: true }],
  ])("usa o CSS com %s", (_n, extra) => {
    expect(decidirModo({ ...BOM, ...extra })).toBe("css");
  });
  it("pausa com a aba oculta e fora da tela", () => {
    expect(decidirModo({ ...BOM, abaOculta: true })).toBe("webgl-pausado");
    expect(decidirModo({ ...BOM, naTela: false })).toBe("webgl-pausado");
  });
  it("o CSS vence a pausa: aba oculta com movimento reduzido continua em css", () => {
    expect(decidirModo({ ...BOM, abaOculta: true, reducedMotion: true })).toBe("css");
  });
});

describe("dispositivoFraco", () => {
  it("considera economia de dados, pouca memória e poucos núcleos", () => {
    expect(dispositivoFraco({ saveData: true })).toBe(true);
    expect(dispositivoFraco({ deviceMemory: 2 })).toBe(true);
    expect(dispositivoFraco({ hardwareConcurrency: 2 })).toBe(true);
  });
  it("não pune quando o navegador não informa", () => {
    expect(dispositivoFraco({})).toBe(false);
    expect(dispositivoFraco({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(dispositivoFraco({ deviceMemory: 4, hardwareConcurrency: 4 })).toBe(false);
  });
});

describe("fpsAlvo e limiteDpr", () => {
  it("60 no desktop e 30 em tela estreita ou toque", () => {
    expect(fpsAlvo(1440, false)).toBe(60);
    expect(fpsAlvo(767, false)).toBe(30);
    expect(fpsAlvo(768, false)).toBe(60);
    expect(fpsAlvo(1440, true)).toBe(30);
  });
  it("limita o dpr", () => {
    expect(limiteDpr(3, 60)).toBe(1.5);
    expect(limiteDpr(3, 30)).toBe(1);
    expect(limiteDpr(1, 60)).toBe(1);
  });
});
