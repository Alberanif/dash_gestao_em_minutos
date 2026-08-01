import { parseDateRange, viewRangeFrom, keyInRange } from "../date-range";

describe("parseDateRange", () => {
  it("aceita duas datas ISO com fim >= início", () => {
    expect(parseDateRange("2026-07-10", "2026-07-20")).toEqual({
      start: "2026-07-10",
      end: "2026-07-20",
    });
  });

  it("aceita intervalo de um único dia", () => {
    expect(parseDateRange("2026-07-10", "2026-07-10")).toEqual({
      start: "2026-07-10",
      end: "2026-07-10",
    });
  });

  it("rejeita fim anterior ao início", () => {
    expect(parseDateRange("2026-07-20", "2026-07-10")).toBeNull();
  });

  it("rejeita ponta vazia ou fora do formato ISO", () => {
    expect(parseDateRange("", "2026-07-20")).toBeNull();
    expect(parseDateRange("2026-07-10", "")).toBeNull();
    expect(parseDateRange("10/07/2026", "20/07/2026")).toBeNull();
    expect(parseDateRange("2026-7-10", "2026-07-20")).toBeNull();
  });
});

describe("viewRangeFrom", () => {
  it("lê a janela salva no ciclo", () => {
    expect(viewRangeFrom("2026-07-10", "2026-07-20")).toEqual({
      start: "2026-07-10",
      end: "2026-07-20",
    });
  });

  it("ciclo sem janela: null nas duas pontas", () => {
    expect(viewRangeFrom(null, null)).toBeNull();
  });

  it("migration 063 ainda não aplicada: as colunas nem vêm na resposta", () => {
    expect(viewRangeFrom(undefined, undefined)).toBeNull();
  });

  it("meia janela degrada para ciclo inteiro, nunca para meio recorte", () => {
    expect(viewRangeFrom("2026-07-10", null)).toBeNull();
    expect(viewRangeFrom(null, "2026-07-20")).toBeNull();
  });

  it("recusa lixo vindo do banco em vez de confiar", () => {
    expect(viewRangeFrom("2026-07-20", "2026-07-10")).toBeNull();
    expect(viewRangeFrom(20260710, 20260720)).toBeNull();
    expect(viewRangeFrom("2026-07-10T00:00:00Z", "2026-07-20T00:00:00Z")).toBeNull();
  });
});

describe("keyInRange", () => {
  const range = { start: "2026-07-10", end: "2026-07-20" };

  it("sem intervalo, tudo passa", () => {
    expect(keyInRange("2026-01-01", null)).toBe(true);
  });

  it("inclui as duas pontas", () => {
    expect(keyInRange("2026-07-10", range)).toBe(true);
    expect(keyInRange("2026-07-20", range)).toBe(true);
  });

  it("exclui fora do intervalo", () => {
    expect(keyInRange("2026-07-09", range)).toBe(false);
    expect(keyInRange("2026-07-21", range)).toBe(false);
  });

  it("aceita chave horária usando só os 10 primeiros caracteres", () => {
    expect(keyInRange("2026-07-20T23", range)).toBe(true);
    expect(keyInRange("2026-07-21T00", range)).toBe(false);
  });
});
