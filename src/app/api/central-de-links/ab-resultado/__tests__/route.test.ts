/* eslint-disable @typescript-eslint/no-explicit-any -- JSON da resposta navegado nos asserts */
import { NextRequest, NextResponse } from "next/server";

const mockExigir = jest.fn();
jest.mock("@/lib/central-de-links/papel-servidor", () => ({
  exigirPapelCentral: (...a: unknown[]) => mockExigir(...a),
}));

// A estatística tem teste próprio: aqui ela é um duplo que ecoa o que recebeu.
const mockComparar = jest.fn();
jest.mock("@/lib/central-de-links/estatistica", () => ({
  compararVariantes: (...a: unknown[]) => mockComparar(...a),
}));

type ErroBanco = { message: string } | null;
const bd = {
  testes: [] as Record<string, unknown>[],
  variantes: [] as Record<string, unknown>[],
  resumo: {} as Record<string, unknown>,
  erroTestes: null as ErroBanco,
  erroVariantes: null as ErroBanco,
  erroRpc: null as ErroBanco,
};
const rpcChamadas: { nome: string; args: Record<string, unknown> }[] = [];
const eqs: [string, string, unknown][] = [];

function consulta(tabela: string) {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = (c: string, v: unknown) => {
    eqs.push([tabela, c, v]);
    return q;
  };
  q.order = () => q;
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
    Promise.resolve(
      tabela === "ab_testes"
        ? { data: bd.erroTestes ? null : bd.testes, error: bd.erroTestes }
        : { data: bd.erroVariantes ? null : bd.variantes, error: bd.erroVariantes },
    ).then(ok, ko);
  return q;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({
    from: (t: string) => consulta(t),
    rpc: (nome: string, args: Record<string, unknown>) => {
      rpcChamadas.push({ nome, args });
      return Promise.resolve(
        bd.erroRpc ? { data: null, error: bd.erroRpc } : { data: bd.resumo, error: null },
      );
    },
  })),
}));

import { GET } from "../route";

const T = "11111111-1111-4111-8111-111111111111";
const VA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LA = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const LB = "b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1";

function chamar(query: Record<string, string | string[]> = { teste: T }) {
  const u = new URL("http://localhost/api/central-de-links/ab-resultado");
  for (const [k, v] of Object.entries(query)) for (const x of [v].flat()) u.searchParams.append(k, x);
  return GET(new NextRequest(u));
}

async function json(r: Response) {
  return (await r.json()) as Record<string, any>;
}

function papel(p: "admin" | "membro" | null) {
  mockExigir.mockImplementation(async () => {
    if (p === null) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null, papel: null };
    }
    if (p !== "membro" && p !== "admin") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: "u", papel: null };
    }
    return { error: null, userId: "u", papel: p };
  });
}

const AGORA = new Date("2026-10-26T12:00:00.000Z");
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 36e5).toISOString();

function semeia(status = "ativo", iniciado: string | null = "2026-10-20T00:00:00Z") {
  bd.testes = [
    { id: T, nome: "Teste X", status, iniciado_em: iniciado, encerrado_em: null, vencedor_variante: null, anotacao: null },
  ];
  bd.variantes = [
    { id: VA, rotulo: "A", controle: true, link_id: LA, central_links: { label: "Página A", url: "https://a" } },
    { id: VB, rotulo: "B", controle: false, link_id: LB, central_links: null },
  ];
  bd.resumo = {
    totais: [
      { variante_id: VA, visualizacoes: "50", unicos: "40", novos: "30", comecaram: "12", leads: "10", envios: "11" },
      { variante_id: VB, visualizacoes: 60, unicos: 50, novos: 55, comecaram: 20, leads: 20, envios: 20 },
    ],
    serie: [
      { variante_id: VA, dia: "2026-10-20", visitantes: 20, leads: 5 },
      { variante_id: VA, dia: "2026-10-21", visitantes: 0, leads: 0 },
    ],
    cortes: [{ variante_id: VB, dimensao: "pais", valor: "BR", visitantes: 4, leads: 1 }],
    ultimos: [
      { link_id: LA, ultimo: horasAtras(2) },
      { link_id: LB, ultimo: horasAtras(7) },
    ],
    filtros: { utm_source: ["ig", "fb"], pais: ["BR"] },
  };
}

beforeEach(() => {
  jest.useFakeTimers({ now: AGORA });
  bd.erroTestes = bd.erroVariantes = bd.erroRpc = null;
  rpcChamadas.length = 0;
  eqs.length = 0;
  mockExigir.mockReset();
  mockComparar.mockReset();
  mockComparar.mockImplementation((base: { id: string }[]) => ({
    variantes: base.map((b) => ({
      id: b.id,
      diferenca_abs: b.id === VB ? 0.15 : null,
      diferenca_rel: b.id === VB ? 0.6 : null,
      p_valor: b.id === VB ? 0.03 : null,
      confianca: b.id === VB ? 0.97 : null,
      faltam: 0,
      veredito: b.id === VB ? "vencedora" : "controle",
    })),
    veredito: "vencedor",
    vencedor_id: VB,
    avisos: ["aviso x"],
    confianca_minima: 0.95,
    amostra_minima: 100,
    controle_id: VA,
  }));
  papel("membro");
  semeia();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("autorização e validação", () => {
  it("sem sessão: 401, sem tocar no banco", async () => {
    papel(null);
    const r = await chamar();
    expect(r.status).toBe(401);
    expect(await json(r)).toEqual({ error: "Unauthorized" });
    expect(rpcChamadas).toHaveLength(0);
    expect(eqs).toHaveLength(0);
  });

  it("sem papel: 403, sem tocar no banco", async () => {
    mockExigir.mockImplementation(async () => ({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: "u",
      papel: null,
    }));
    const r = await chamar();
    expect(r.status).toBe(403);
    expect(eqs).toHaveLength(0);
  });

  it("exige papel membro (admin também passa)", async () => {
    await chamar();
    expect(mockExigir).toHaveBeenCalledWith("membro");
    papel("admin");
    expect((await chamar()).status).toBe(200);
  });

  it.each([["ausente", {}], ["não uuid", { teste: "abc" }], ["com lixo", { teste: T + "x" }]])(
    "400 teste inválido: %s",
    async (_n, q) => {
      const r = await chamar(q as Record<string, string>);
      expect(r.status).toBe(400);
      expect(await json(r)).toEqual({ erro: "Teste inválido." });
      expect(eqs).toHaveLength(0);
    },
  );

  it("aceita uuid em maiúsculas", async () => {
    expect((await chamar({ teste: VA.toUpperCase() })).status).toBe(200);
  });

  it("400 filtro com mais de 200 caracteres (200 passa) e filtro repetido", async () => {
    const longo = await chamar({ teste: T, pais: "x".repeat(201) });
    expect(longo.status).toBe(400);
    expect(await json(longo)).toEqual({ erro: "Filtro inválido: pais." });
    expect((await chamar({ teste: T, pais: "x".repeat(200) })).status).toBe(200);
    const duplo = await chamar({ teste: T, dispositivo: ["a", "b"] });
    expect(duplo.status).toBe(400);
    expect(await json(duplo)).toEqual({ erro: "Filtro inválido: dispositivo." });
  });

  it("404 quando o teste não existe", async () => {
    bd.testes = [];
    const r = await chamar();
    expect(r.status).toBe(404);
    expect(await json(r)).toEqual({ erro: "Teste não encontrado." });
  });

  it("502 quando o banco falha (teste, variantes ou resumo), sem vazar detalhe", async () => {
    bd.erroTestes = { message: "segredo" };
    let r = await chamar();
    expect(r.status).toBe(502);
    expect(await json(r)).toEqual({ erro: "Falha ao consultar o banco." });
    bd.erroTestes = null;
    bd.erroVariantes = { message: "segredo" };
    expect((await chamar()).status).toBe(502);
    bd.erroVariantes = null;
    bd.erroRpc = { message: "segredo" };
    r = await chamar();
    expect(r.status).toBe(502);
    expect(JSON.stringify(await json(r))).not.toContain("segredo");
  });

  it("exceção inesperada: 500 genérico", async () => {
    mockComparar.mockImplementation(() => {
      throw new Error("segredo interno");
    });
    const r = await chamar();
    expect(r.status).toBe(500);
    expect(await json(r)).toEqual({ erro: "Erro interno." });
  });

  it("respostas sem cache (sucesso e erro)", async () => {
    expect((await chamar()).headers.get("cache-control")).toBe("no-store");
    expect((await chamar({})).headers.get("cache-control")).toBe("no-store");
  });
});

describe("consulta ao banco", () => {
  it("busca o teste e as variantes pelo id", async () => {
    await chamar();
    expect(eqs).toEqual(
      expect.arrayContaining([
        ["ab_testes", "id", T],
        ["ab_variantes", "teste_id", T],
      ]),
    );
  });

  it("sem filtros: rpc com todos os parâmetros nulos", async () => {
    await chamar();
    expect(rpcChamadas).toEqual([
      {
        nome: "ab_resumo",
        args: {
          p_teste: T,
          p_utm_source: null,
          p_utm_medium: null,
          p_utm_campaign: null,
          p_dispositivo: null,
          p_pais: null,
        },
      },
    ]);
  });

  it("repassa cada filtro ao seu parâmetro e devolve filtros_aplicados", async () => {
    const r = await chamar({
      teste: T,
      utm_source: "ig",
      utm_medium: "cpc",
      utm_campaign: "black",
      dispositivo: "mobile",
      pais: "BR",
    });
    expect(rpcChamadas[0].args).toEqual({
      p_teste: T,
      p_utm_source: "ig",
      p_utm_medium: "cpc",
      p_utm_campaign: "black",
      p_dispositivo: "mobile",
      p_pais: "BR",
    });
    expect((await json(r)).filtros_aplicados).toEqual({
      utm_source: "ig",
      utm_medium: "cpc",
      utm_campaign: "black",
      dispositivo: "mobile",
      pais: "BR",
    });
  });

  it("filtro vazio é ignorado", async () => {
    const r = await chamar({ teste: T, pais: "" });
    expect(rpcChamadas[0].args.p_pais).toBeNull();
    expect((await json(r)).filtros_aplicados).toEqual({});
  });

  it("teste sem iniciado_em: não chama o rpc e devolve tudo zerado, sem alerta", async () => {
    semeia("rascunho", null);
    const r = await chamar();
    expect(r.status).toBe(200);
    expect(rpcChamadas).toHaveLength(0);
    const j = await json(r);
    expect(j.filtros_disponiveis).toEqual({ utm_source: [], utm_medium: [], utm_campaign: [], dispositivo: [], pais: [] });
    for (const v of j.variantes) {
      expect(v).toMatchObject({ visualizacoes: 0, unicos: 0, novos: 0, recorrentes: 0, leads: 0, envios: 0, conversao: 0 });
      expect(v.funil).toEqual({ visitaram: 0, comecaram: 0, enviaram: 0 });
      expect(v.serie).toEqual([]);
      expect(v.cortes).toEqual([]);
      expect(v.saude).toEqual({ ultimo_evento: null, horas_sem_evento: null, alerta: false });
    }
  });
});

describe("resposta", () => {
  it("entrega ao cálculo estatístico visitantes únicos e leads por variante (numéricos)", async () => {
    await chamar();
    expect(mockComparar).toHaveBeenCalledWith([
      { id: VA, controle: true, visitantes: 40, leads: 10 },
      { id: VB, controle: false, visitantes: 50, leads: 20 },
    ]);
  });

  it("monta o JSON do original: teste, filtros disponíveis, veredito, limiar de horas", async () => {
    const j = await json(await chamar());
    expect(j.teste).toMatchObject({ id: T, nome: "Teste X", status: "ativo" });
    expect(j.filtros_disponiveis).toEqual({
      utm_source: ["ig", "fb"],
      utm_medium: [],
      utm_campaign: [],
      dispositivo: [],
      pais: ["BR"],
    });
    expect(j.veredito).toEqual({
      resultado: "vencedor",
      vencedor_id: VB,
      avisos: ["aviso x"],
      confianca_minima: 0.95,
      amostra_minima: 100,
      controle_id: VA,
    });
    expect(j.horas_sem_evento_alerta).toBe(6);
    expect(j.variantes.map((v: any) => v.id)).toEqual([VA, VB]);
    expect(Object.keys(j).sort()).toEqual(
      ["filtros_aplicados", "filtros_disponiveis", "horas_sem_evento_alerta", "teste", "variantes", "veredito"].sort(),
    );
  });

  it("números por variante: recorrentes, conversão = leads/únicos, funil, strings viram número", async () => {
    const [a, b] = (await json(await chamar())).variantes;
    expect(a).toMatchObject({
      id: VA,
      rotulo: "A",
      controle: true,
      link_id: LA,
      pagina: "Página A",
      url: "https://a",
      visualizacoes: 50,
      unicos: 40,
      novos: 30,
      recorrentes: 10,
      leads: 10,
      envios: 11,
      conversao: 0.25,
      funil: { visitaram: 40, comecaram: 12, enviaram: 10 },
    });
    expect(b).toMatchObject({ pagina: null, url: null, unicos: 50, leads: 20, conversao: 0.4 });
    // novos > únicos nunca gera recorrentes negativos
    expect(b.recorrentes).toBe(0);
  });

  it("variante sem eventos: zeros, conversão 0 (sem divisão por zero)", async () => {
    bd.resumo = { ...bd.resumo, totais: [], serie: [], cortes: [], ultimos: [] };
    const j = await json(await chamar());
    for (const v of j.variantes) {
      expect(v.conversao).toBe(0);
      expect(v.unicos).toBe(0);
    }
  });

  it("estatística por variante vem do cálculo; nulos quando ausente", async () => {
    const [a, b] = (await json(await chamar())).variantes;
    expect(b.estatistica).toEqual({
      diferenca_abs: 0.15,
      diferenca_rel: 0.6,
      p_valor: 0.03,
      confianca: 0.97,
      faltam: 0,
      veredito: "vencedora",
    });
    expect(a.estatistica).toEqual({
      diferenca_abs: null,
      diferenca_rel: null,
      p_valor: null,
      confianca: null,
      faltam: 0,
      veredito: "controle",
    });
  });

  it("zero legítimo não vira null na estatística", async () => {
    mockComparar.mockImplementation((base: { id: string }[]) => ({
      variantes: base.map((b) => ({
        id: b.id,
        diferenca_abs: 0,
        diferenca_rel: 0,
        p_valor: 0,
        confianca: 0,
        faltam: 0,
        veredito: "",
      })),
      veredito: "x",
      vencedor_id: null,
      avisos: [],
      confianca_minima: 0.95,
      amostra_minima: 100,
      controle_id: VA,
    }));
    const [a] = (await json(await chamar())).variantes;
    expect(a.estatistica).toEqual({
      diferenca_abs: 0,
      diferenca_rel: 0,
      p_valor: 0,
      confianca: 0,
      faltam: 0,
      veredito: null,
    });
  });

  it("série e cortes só da própria variante, com conversão calculada", async () => {
    const [a, b] = (await json(await chamar())).variantes;
    expect(a.serie).toEqual([
      { dia: "2026-10-20", visitantes: 20, leads: 5, conversao: 0.25 },
      { dia: "2026-10-21", visitantes: 0, leads: 0, conversao: 0 },
    ]);
    expect(a.cortes).toEqual([]);
    expect(b.serie).toEqual([]);
    expect(b.cortes).toEqual([{ dimensao: "pais", valor: "BR", visitantes: 4, leads: 1, conversao: 0.25 }]);
  });
});

describe("saúde da instalação", () => {
  it("ativo: alerta só acima de 6 h sem evento; horas arredondadas a 1 casa", async () => {
    const [a, b] = (await json(await chamar())).variantes;
    expect(a.saude).toEqual({ ultimo_evento: horasAtras(2), horas_sem_evento: 2, alerta: false });
    expect(b.saude).toEqual({ ultimo_evento: horasAtras(7), horas_sem_evento: 7, alerta: true });
  });

  it("exatamente 6 h não alerta; 6,1 h alerta", async () => {
    (bd.resumo.ultimos as Record<string, unknown>[])[0].ultimo = horasAtras(6);
    (bd.resumo.ultimos as Record<string, unknown>[])[1].ultimo = horasAtras(6.1);
    const [a, b] = (await json(await chamar())).variantes;
    expect(a.saude.alerta).toBe(false);
    expect(b.saude).toMatchObject({ horas_sem_evento: 6.1, alerta: true });
  });

  it("arredonda a 1 casa decimal", async () => {
    (bd.resumo.ultimos as Record<string, unknown>[])[0].ultimo = horasAtras(2.26);
    const [a] = (await json(await chamar())).variantes;
    expect(a.saude.horas_sem_evento).toBe(2.3);
  });

  it("ativo sem nenhum evento: alerta com horas nulas", async () => {
    bd.resumo = { ...bd.resumo, ultimos: [{ link_id: LB, ultimo: horasAtras(1) }] };
    const [a, b] = (await json(await chamar())).variantes;
    expect(a.saude).toEqual({ ultimo_evento: null, horas_sem_evento: null, alerta: true });
    expect(b.saude.alerta).toBe(false);
  });

  it("evento com valor nulo no rpc conta como sem evento", async () => {
    bd.resumo = { ...bd.resumo, ultimos: [{ link_id: LA, ultimo: null }] };
    const [a] = (await json(await chamar())).variantes;
    expect(a.saude).toEqual({ ultimo_evento: null, horas_sem_evento: null, alerta: true });
  });

  it.each(["rascunho", "encerrado"])("teste %s nunca alerta, mesmo sem eventos recentes", async (st) => {
    semeia(st);
    bd.resumo = { ...bd.resumo, ultimos: [{ link_id: LB, ultimo: horasAtras(100) }] };
    const j = await json(await chamar());
    for (const v of j.variantes) expect(v.saude.alerta).toBe(false);
  });
});
