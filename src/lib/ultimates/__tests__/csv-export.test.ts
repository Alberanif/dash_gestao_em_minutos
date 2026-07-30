import { buildRosterCsv } from "../csv-export";
import { filterRosterRows } from "../table-filter";
import type { UltimatesRosterRow } from "@/types/ultimates";

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

describe("buildRosterCsv", () => {
  it("começa com BOM UTF-8 (para o Excel pt-BR abrir acentos corretamente)", () => {
    const csv = buildRosterCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("usa ; como separador e inclui o cabeçalho fixo mesmo sem linhas", () => {
    const csv = buildRosterCsv([]);
    const header = csv.slice(1).split("\r\n")[0];
    expect(header).toBe("Nome;Email;Telefone;Categoria;Data da renovação;Valor");
  });

  it("gera uma linha por row com categoria em pt-BR e — para data/valor ausentes", () => {
    const csv = buildRosterCsv([
      row({ name: "Maria", email: "maria@example.com", phone: "11999990000", category: "nao_renovado" }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe("Maria;maria@example.com;11999990000;Não renovado;—;—");
  });

  it("formata data (dd/mm/aaaa) e valor (BRL) quando presentes", () => {
    const csv = buildRosterCsv([
      row({
        name: "Maria",
        email: "maria@example.com",
        category: "renovado",
        renewed_at: "2026-05-01T12:00:00Z",
        total_value: 199.9,
      }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    // O valor BRL tem vírgula (separador decimal pt-BR), que colide com o
    // caractere que o teste de escaping cobre — por isso o campo fica entre
    // aspas mesmo não contendo o separador ";".
    expect(lines[1]).toBe('Maria;maria@example.com;;Renovado;01/05/2026;"R$ 199,90"');
  });

  it("faz escaping RFC 4180 de vírgula, ponto-e-vírgula e aspas — envolve em aspas e dobra aspas internas", () => {
    const csv = buildRosterCsv([
      row({ name: 'Maria "M." Silva, Jr; Souza', email: "maria@example.com" }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe(
      '"Maria ""M."" Silva, Jr; Souza";maria@example.com;;Renovado;—;—'
    );
  });

  it("adiciona colunas extras como a união das chaves de extra entre todas as linhas exportadas", () => {
    const csv = buildRosterCsv([
      row({ name: "A", email: "a@example.com", extra: { cidade: "SP" } }),
      row({ name: "B", email: "b@example.com", extra: { telefone_2: "123" } }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Nome;Email;Telefone;Categoria;Data da renovação;Valor;cidade;telefone_2");
    expect(lines[1]).toBe("A;a@example.com;;Renovado;—;—;SP;");
    expect(lines[2]).toBe("B;b@example.com;;Renovado;—;—;;123");
  });

  it("neutraliza fórmulas (CSV injection): campo começando com = + - @ ganha apóstrofo à frente", () => {
    const csv = buildRosterCsv([
      row({
        name: '=HYPERLINK("http://evil.com";"clique")',
        email: "a@example.com",
        extra: { obs: "+55 11 99999-0000", nota: "-1", arroba: "@menção" },
      }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe(
      "\"'=HYPERLINK(\"\"http://evil.com\"\";\"\"clique\"\")\";a@example.com;;Renovado;—;—;'+55 11 99999-0000;'-1;'@menção"
    );
  });

  it("neutraliza fórmula também com quebra de linha no campo (quoting preserva o apóstrofo)", () => {
    const csv = buildRosterCsv([
      row({ name: "=1+1\nlinha2", email: "a@example.com" }),
    ]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe("\"'=1+1\nlinha2\";a@example.com;;Renovado;—;—");
  });

  it("compõe com o filtro da tabela: exportar só 'nao_renovado' gera CSV apenas dessa categoria", () => {
    const rows = [
      row({ name: "Renovou", email: "r@example.com", category: "renovado" }),
      row({ name: "Não Renovou", email: "n@example.com", category: "nao_renovado", extra: { origem: "site" } }),
    ];
    const filtered = filterRosterRows(rows, { search: "", category: "nao_renovado" });
    const csv = buildRosterCsv(filtered);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(2); // header + 1 linha
    expect(lines[1]).toContain("Não Renovou");
    expect(lines[1]).toContain("Não renovado");
    expect(csv).not.toContain("r@example.com");
  });
});

describe("buildRosterCsv — categorias de renovação sem vínculo", () => {
  it("exporta o rótulo pt-BR da renovação sem vínculo", () => {
    const csv = buildRosterCsv([row({ category: "renovacao_sem_vinculo" })]);
    expect(csv).toContain("Renovação sem vínculo");
  });

  it("exporta o rótulo da reembolsada sem virar duas colunas", () => {
    const csv = buildRosterCsv([row({ category: "renovacao_sem_vinculo_reembolsada" })]);
    expect(csv).toContain("Renovação sem vínculo — reembolsada");
  });
});
