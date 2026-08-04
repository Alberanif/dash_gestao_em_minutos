import {
  fmtBRL,
  fmtPercent1,
  fmtDateFull,
  fmtDateShort,
  fmtHourShort,
  fmtHourLong,
  categoryLabel,
  formatCycleProducts,
} from "../format";
import type { UltimatesCycleProductRef } from "@/types/ultimates";

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

describe("categoryLabel", () => {
  it("mapeia todas as 5 categorias para os rotulos pt-BR do PRD", () => {
    expect(categoryLabel("renovado")).toBe("Renovado");
    expect(categoryLabel("nao_renovado")).toBe("Não renovado");
    expect(categoryLabel("renovacao_reembolsada")).toBe("Renovação reembolsada");
    expect(categoryLabel("novo_comprador")).toBe("Novo Comprador");
    expect(categoryLabel("novo_reembolsado")).toBe("Novo — reembolsado");
  });
});

describe("categoryLabel — categorias de renovação sem vínculo", () => {
  it("rotula renovacao_sem_vinculo", () => {
    expect(categoryLabel("renovacao_sem_vinculo")).toBe("Renovação sem vínculo");
  });

  it("rotula renovacao_sem_vinculo_reembolsada com o travessão do idioma existente", () => {
    expect(categoryLabel("renovacao_sem_vinculo_reembolsada")).toBe(
      "Renovação sem vínculo — reembolsada"
    );
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

// formatCycleProducts só lê id e nome, mas recebe UltimatesCycleProductRef
// inteiro — e a migration 065 acrescentou as três colunas de oferta ao tipo.
// O helper preenche o que o formatador ignora, para o fixture continuar
// dizendo só o que o teste é sobre.
function prod(product_id: string, product_name: string | null): UltimatesCycleProductRef {
  return {
    product_id,
    product_name,
    offer_codes: [],
    rejected_offer_codes: [],
    include_offerless: null,
  };
}

describe("formatCycleProducts", () => {
  it("junta até 3 nomes com separador", () => {
    expect(formatCycleProducts([prod("1", "Anual"), prod("2", "Mensal")])).toBe("Anual · Mensal");
  });

  // Fronteira exata entre juntar nomes e resumir em contagem. Sem este caso,
  // trocar `> 3` por `>= 3` no formatador passaria despercebido.
  it("com exatamente 3 produtos ainda junta os nomes", () => {
    expect(
      formatCycleProducts([prod("1", "Anual"), prod("2", "Mensal"), prod("3", "Trimestral")])
    ).toBe("Anual · Mensal · Trimestral");
  });

  it("resume a partir de 4 produtos", () => {
    expect(
      formatCycleProducts([prod("1", "A"), prod("2", "B"), prod("3", "C"), prod("4", "D")])
    ).toBe("4 produtos");
  });

  it("cai no product_id quando o nome não foi sincronizado", () => {
    expect(formatCycleProducts([prod("1234567", null)])).toBe("1234567");
  });

  it("conjunto vazio mantém o texto de ausência do módulo", () => {
    expect(formatCycleProducts([])).toBe("Produto não identificado");
  });
});
