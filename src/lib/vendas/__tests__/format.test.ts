import {
  fmtBRL,
  fmtPercent1,
  fmtDateFull,
  fmtDateShort,
  fmtHourShort,
  fmtHourLong,
} from "../format";

// Intl.NumberFormat("pt-BR", { style: "currency" }) usa NBSP (U+00A0) entre
// "R$" e o valor, nao espaco comum -- normaliza antes de comparar para nao
// depender de um caractere invisivel no fixture do teste.
function normalizeSpaces(s: string): string {
  return s.replace(/ /g, " ");
}

describe("fmtBRL", () => {
  it("formata numero como moeda BRL pt-BR com centavos", () => {
    expect(normalizeSpaces(fmtBRL(1234.5))).toBe("R$ 1.234,50");
  });

  it("formata zero", () => {
    expect(normalizeSpaces(fmtBRL(0))).toBe("R$ 0,00");
  });
});

describe("fmtPercent1", () => {
  it("formata com uma casa decimal e virgula pt-BR", () => {
    expect(fmtPercent1(33.333)).toBe("33,3%");
  });

  it("formata 100 com uma casa decimal", () => {
    expect(fmtPercent1(100)).toBe("100,0%");
  });

  it("formata zero", () => {
    expect(fmtPercent1(0)).toBe("0,0%");
  });
});

describe("fmtDateFull", () => {
  it("formata timestamp ISO como dd/mm/aaaa usando componentes UTC (sem deslocar por timezone local)", () => {
    expect(fmtDateFull("2026-05-01T23:30:00Z")).toBe("01/05/2026");
  });

  it("retorna em-dash quando o valor e null", () => {
    expect(fmtDateFull(null)).toBe("—");
  });

  it("retorna em-dash quando o valor nao e uma data valida", () => {
    expect(fmtDateFull("not-a-date")).toBe("—");
  });
});

describe("fmtDateShort", () => {
  it("converte YYYY-MM-DD para dd/mm", () => {
    expect(fmtDateShort("2026-05-01")).toBe("01/05");
  });
});

describe("fmtHourShort", () => {
  it("formata a chave horaria como dd/mm HHh", () => {
    expect(fmtHourShort("2026-07-30T14")).toBe("30/07 14h");
  });

  it("preserva o zero a esquerda da meia-noite", () => {
    expect(fmtHourShort("2026-07-30T00")).toBe("30/07 00h");
  });

  it("formata hora de mes com um digito", () => {
    expect(fmtHourShort("2026-08-01T09")).toBe("01/08 09h");
  });
});

describe("fmtHourLong", () => {
  it("formata a chave horaria como dd/mm as HHh", () => {
    expect(fmtHourLong("2026-07-30T14")).toBe("30/07 às 14h");
  });

  it("preserva o zero a esquerda da meia-noite", () => {
    expect(fmtHourLong("2026-07-30T00")).toBe("30/07 às 00h");
  });
});
