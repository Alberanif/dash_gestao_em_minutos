import { filterRosterRows } from "../table-filter";
import type { UltimatesRosterRow } from "@/types/vendas";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

const ROWS: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", name: "Maria Silva", email: "maria@example.com", category: "renovado" }),
  row({ buyer_id: "b2", name: "João Souza", email: "joao@example.com", category: "nao_renovado" }),
  row({ buyer_id: "b3", name: null, email: "sem.nome@example.com", category: "renovacao_reembolsada" }),
  row({ buyer_id: null, name: "Ana Nova", email: "ana@example.com", category: "novo_comprador" }),
];

describe("filterRosterRows", () => {
  it("sem busca e categoria 'todas' retorna tudo", () => {
    expect(filterRosterRows(ROWS, { search: "", category: "todas" })).toHaveLength(4);
  });

  it("filtra por categoria exata", () => {
    const result = filterRosterRows(ROWS, { search: "", category: "nao_renovado" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("João Souza");
  });

  it("busca por nome, case-insensitive", () => {
    const result = filterRosterRows(ROWS, { search: "maria", category: "todas" });
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("maria@example.com");
  });

  it("busca por email, case-insensitive", () => {
    const result = filterRosterRows(ROWS, { search: "ANA@EXAMPLE", category: "todas" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Ana Nova");
  });

  it("busca por substring parcial", () => {
    const result = filterRosterRows(ROWS, { search: "souz", category: "todas" });
    expect(result).toHaveLength(1);
  });

  it("não quebra quando name é null e a busca não bate com o email", () => {
    const result = filterRosterRows(ROWS, { search: "silva", category: "todas" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Maria Silva");
  });

  it("combina busca + categoria (interseção, não união)", () => {
    const result = filterRosterRows(ROWS, { search: "a", category: "novo_comprador" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Ana Nova");
  });

  it("retorna vazio quando nada bate", () => {
    expect(filterRosterRows(ROWS, { search: "inexistente", category: "todas" })).toEqual([]);
  });

  it("ignora espaços em branco ao redor do termo de busca", () => {
    const result = filterRosterRows(ROWS, { search: "  maria  ", category: "todas" });
    expect(result).toHaveLength(1);
  });
});

describe("filterRosterRows — categorias de renovação sem vínculo", () => {
  it("filtra por renovacao_sem_vinculo", () => {
    const rows = [
      row({ category: "renovado" }),
      row({ category: "renovacao_sem_vinculo", email: "sem@example.com" }),
    ];
    const out = filterRosterRows(rows, { search: "", category: "renovacao_sem_vinculo" });
    expect(out.map((r) => r.email)).toEqual(["sem@example.com"]);
  });

  it("filtra por renovacao_sem_vinculo_reembolsada", () => {
    const rows = [
      row({ category: "renovacao_sem_vinculo" }),
      row({ category: "renovacao_sem_vinculo_reembolsada", email: "rb@example.com" }),
    ];
    const out = filterRosterRows(rows, {
      search: "",
      category: "renovacao_sem_vinculo_reembolsada",
    });
    expect(out.map((r) => r.email)).toEqual(["rb@example.com"]);
  });
});
