import {
  aggregateOriginDimension,
  normalizeOriginEmail,
  SEM_INFORMACAO,
  type OriginBaseRow,
} from "../origin-breakdown";

// Base de inscritos enxuta com a MESMA forma da real: Presencial converte
// melhor que Online, e Online tem base maior — é o par que separa "ordenar por
// conversão" de "ordenar por volume".
const BASE: OriginBaseRow[] = [
  { email: "p1@ex.com", origin: "Presencial" },
  { email: "p2@ex.com", origin: "Presencial" },
  { email: "p3@ex.com", origin: "Presencial" },
  { email: "p4@ex.com", origin: "Presencial" },
  { email: "o1@ex.com", origin: "Online" },
  { email: "o2@ex.com", origin: "Online" },
  { email: "o3@ex.com", origin: "Online" },
  { email: "o4@ex.com", origin: "Online" },
  { email: "o5@ex.com", origin: "Online" },
  { email: "o6@ex.com", origin: "Online" },
  { email: "o7@ex.com", origin: "Online" },
  { email: "o8@ex.com", origin: "Online" },
];

describe("aggregateOriginDimension", () => {
  it("conta compras por origem e calcula conversão sobre a base inteira", () => {
    const rows = aggregateOriginDimension(["p1@ex.com", "p2@ex.com", "o1@ex.com"], BASE);

    expect(rows).toEqual([
      { origin: "Presencial", purchases: 2, base: 4, conversion: 50 },
      { origin: "Online", purchases: 1, base: 8, conversion: 12.5 },
    ]);
  });

  it("ordena por conversão desc, não por volume de compras", () => {
    // Online vende MAIS em absoluto (3 x 2) e converte MENOS (37,5% x 50%).
    const rows = aggregateOriginDimension(
      ["p1@ex.com", "p2@ex.com", "o1@ex.com", "o2@ex.com", "o3@ex.com"],
      BASE
    );

    expect(rows.map((r) => r.origin)).toEqual(["Presencial", "Online"]);
    expect(rows[0]).toMatchObject({ purchases: 2, conversion: 50 });
    expect(rows[1]).toMatchObject({ purchases: 3, conversion: 37.5 });
  });

  it("mantém a origem sem nenhuma compra, com zero e 0%", () => {
    const rows = aggregateOriginDimension(["p1@ex.com"], BASE);

    expect(rows).toContainEqual({
      origin: "Online",
      purchases: 0,
      base: 8,
      conversion: 0,
    });
  });

  it("joga compras fora da base numa linha própria, sempre por último", () => {
    const rows = aggregateOriginDimension(["p1@ex.com", "fantasma@ex.com"], BASE);

    expect(rows[rows.length - 1]).toEqual({
      origin: null,
      purchases: 1,
      base: null,
      conversion: null,
    });
    // Não encontrados NÃO entra na conversão de ninguém.
    expect(rows.find((r) => r.origin === "Presencial")).toMatchObject({
      purchases: 1,
      base: 4,
    });
  });

  it("omite a linha de não encontrados quando todo mundo bate", () => {
    const rows = aggregateOriginDimension(["p1@ex.com", "o1@ex.com"], BASE);

    expect(rows.some((r) => r.origin === null)).toBe(false);
  });

  it("normaliza caixa e espaço dos dois lados do cruzamento", () => {
    const rows = aggregateOriginDimension(
      ["  P1@EX.COM  "],
      [{ email: "P1@Ex.Com", origin: "Presencial" }]
    );

    expect(rows).toEqual([
      { origin: "Presencial", purchases: 1, base: 1, conversion: 100 },
    ]);
  });

  it("não conta o mesmo email duas vezes", () => {
    // Um email repetido inflaria o bucket sem inflar o KPI "Compras" do topo,
    // e a tabela passaria a contradizer o dashboard em silêncio.
    const rows = aggregateOriginDimension(["p1@ex.com", "p1@ex.com", "P1@ex.com"], BASE);

    expect(rows[0]).toMatchObject({ origin: "Presencial", purchases: 1 });
  });

  it("agrupa inscrito sem dimensão preenchida em vez de descartá-lo da base", () => {
    const rows = aggregateOriginDimension(
      ["x@ex.com"],
      [
        { email: "x@ex.com", origin: null },
        { email: "y@ex.com", origin: "   " },
      ]
    );

    // Descartar essas linhas encolheria a base e inflaria a conversão alheia.
    expect(rows).toEqual([
      { origin: SEM_INFORMACAO, purchases: 1, base: 2, conversion: 50 },
    ]);
  });

  it("ignora email vazio dos dois lados", () => {
    const rows = aggregateOriginDimension(
      ["", "   ", "p1@ex.com"],
      [...BASE, { email: "", origin: "Presencial" }]
    );

    expect(rows.find((r) => r.origin === "Presencial")).toEqual({
      origin: "Presencial",
      purchases: 1,
      base: 4,
      conversion: 25,
    });
    expect(rows.some((r) => r.origin === null)).toBe(false);
  });

  it("devolve lista vazia quando não há base", () => {
    expect(aggregateOriginDimension(["p1@ex.com"], [])).toEqual([
      { origin: null, purchases: 1, base: null, conversion: null },
    ]);
    expect(aggregateOriginDimension([], [])).toEqual([]);
  });

  it("desempata conversões iguais por base desc e depois por rótulo", () => {
    const base: OriginBaseRow[] = [
      { email: "a1@ex.com", origin: "Zulu" },
      { email: "a2@ex.com", origin: "Zulu" },
      { email: "b1@ex.com", origin: "Alfa" },
      { email: "b2@ex.com", origin: "Alfa" },
      { email: "c1@ex.com", origin: "Bravo" },
    ];
    // Zulu e Alfa: 50% cada, base 2. Bravo: 0%.
    const rows = aggregateOriginDimension(["a1@ex.com", "b1@ex.com"], base);

    expect(rows.map((r) => r.origin)).toEqual(["Alfa", "Zulu", "Bravo"]);
  });
});

describe("normalizeOriginEmail", () => {
  it("apara e minúscula strings, e devolve vazio para não-string", () => {
    expect(normalizeOriginEmail("  A@B.COM ")).toBe("a@b.com");
    expect(normalizeOriginEmail(null)).toBe("");
    expect(normalizeOriginEmail(42)).toBe("");
  });
});
