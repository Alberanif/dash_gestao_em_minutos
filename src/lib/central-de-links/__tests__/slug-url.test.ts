import { slugDe, slugValido, slugLivre } from "../slug";
import { urlValida } from "../url";

describe("slugDe", () => {
  it("minúsculas, sem acento, hífens", () => {
    expect(slugDe("  Oferta de Outubro — Édição Única!  ")).toBe("oferta-de-outubro-edicao-unica");
  });
  it("corta em 60 caracteres", () => {
    expect(slugDe("a".repeat(80))).toHaveLength(60);
  });
  it("vazio quando não sobra nada", () => {
    expect(slugDe("!!!")).toBe("");
  });
});

describe("slugValido", () => {
  it("aceita minúsculas, números e hífen entre blocos", () => {
    expect(slugValido("oferta-2")).toBe(true);
    expect(slugValido("a-b-c")).toBe(true);
    expect(slugValido("-a")).toBe(false);
    expect(slugValido("a--b")).toBe(false);
    expect(slugValido("A")).toBe(false);
    expect(slugValido("")).toBe(false);
  });
});

describe("slugLivre", () => {
  it("devolve a base quando livre", () => {
    expect(slugLivre("x", new Set())).toBe("x");
  });
  it("acrescenta -2, -3 até achar livre", () => {
    expect(slugLivre("x", new Set(["x", "x-2"]))).toBe("x-3");
  });
  it("base vazia vira 'pagina'", () => {
    expect(slugLivre("", new Set(["pagina"]))).toBe("pagina-2");
  });
});

describe("urlValida", () => {
  it("exige http(s)", () => {
    expect(urlValida("https://a.com/x?y=1")).toBe(true);
    expect(urlValida("HTTP://a.com")).toBe(true);
    expect(urlValida("ftp://a.com")).toBe(false);
    expect(urlValida("a.com")).toBe(false);
    expect(urlValida("https://")).toBe(false);
    expect(urlValida("https://a b")).toBe(false);
    expect(urlValida("http://[")).toBe(false);
  });
});
