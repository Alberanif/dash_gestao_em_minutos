/** @jest-environment jsdom */
import {
  parseDateRange,
  readStoredRange,
  writeStoredRange,
  clearStoredRange,
  keyInRange,
} from "../date-range";

const KEY = "ultimates-date-range";

beforeEach(() => {
  localStorage.clear();
});

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

describe("localStorage", () => {
  it("faz round-trip do intervalo gravado", () => {
    writeStoredRange({ start: "2026-07-10", end: "2026-07-20" });
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({
      start: "2026-07-10",
      end: "2026-07-20",
    });
    expect(readStoredRange()).toEqual({ start: "2026-07-10", end: "2026-07-20" });
  });

  it("devolve null quando não há nada gravado", () => {
    expect(readStoredRange()).toBeNull();
  });

  it("ignora E APAGA payload corrompido, meia ponta ou invertido", () => {
    localStorage.setItem(KEY, "{isso não é json");
    expect(readStoredRange()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ start: "2026-07-10" }));
    expect(readStoredRange()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ start: "2026-07-20", end: "2026-07-10" }));
    expect(readStoredRange()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("clearStoredRange remove a chave", () => {
    writeStoredRange({ start: "2026-07-10", end: "2026-07-20" });
    clearStoredRange();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("não lança quando o localStorage é inacessível", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => writeStoredRange({ start: "2026-07-10", end: "2026-07-20" })).not.toThrow();
    spy.mockRestore();
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
