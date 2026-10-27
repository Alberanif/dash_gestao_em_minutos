import { NextRequest, NextResponse } from "next/server";

const mockExigir = jest.fn();
jest.mock("@/lib/central-de-links/papel-servidor", () => ({
  exigirPapelCentral: (...a: unknown[]) => mockExigir(...a),
}));

// --- Supabase falso, em memória: tabelas + gatilhos (página única em teste ativo)
type Linha = Record<string, unknown> & { id: string };
type ErroBanco = { code?: string; message?: string };
const bd = {
  ab_testes: [] as Linha[],
  ab_variantes: [] as Linha[],
  central_links: [] as Linha[],
};
let seq = 0;
// falha injetada nos próximos N inserts em ab_variantes
let falhaInsert: { erro: ErroBanco; vezes: number } | null = null;
// roda no início de um update (simula outra chamada mexendo no teste no meio)
let antesDoUpdate: (() => void) | null = null;
const chamadas: { tabela: string; op: string; payload?: unknown; filtros: string[] }[] = [];

const ERRO_PAGINA = "Esta página já está em outro teste ativo.";
const ERRO_ROTULO = "Já existe uma variante com esse rótulo neste teste.";

function novoId() {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function comVariantes(t: Linha) {
  return {
    ...t,
    ab_variantes: bd.ab_variantes
      .filter((v) => v.teste_id === t.id)
      .map((v) => ({ ...v, central_links: bd.central_links.find((l) => l.id === v.link_id) ?? null })),
  };
}

function construtor(tabela: keyof typeof bd) {
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: unknown;
  const eqs: [string, unknown][] = [];
  let ins: [string, unknown[]] | null = null;
  let um: "single" | "maybe" | null = null;
  let retorna = false;
  const q: Record<string, unknown> = {};

  const resolver = (): { data: unknown; error: ErroBanco | null } => {
    chamadas.push({ tabela, op, payload, filtros: eqs.map(([c, v]) => `${c}=${String(v)}`) });
    const alvo = bd[tabela];
    const casa = (l: Linha) => eqs.every(([c, v]) => l[c] === v) && (!ins || ins[1].includes(l[ins[0]]));
    if (op === "select") {
      let linhas = alvo.filter(casa);
      if (tabela === "ab_testes") linhas = linhas.map(comVariantes) as Linha[];
      if (um) return { data: linhas[0] ?? null, error: null };
      return { data: linhas, error: null };
    }
    if (op === "insert") {
      const novos = (Array.isArray(payload) ? payload : [payload]) as Record<string, unknown>[];
      if (tabela === "ab_variantes" && falhaInsert && falhaInsert.vezes > 0) {
        falhaInsert.vezes -= 1;
        return { data: null, error: falhaInsert.erro };
      }
      const criados = novos.map((n) => ({ id: novoId(), status: "rascunho", ...n }) as Linha);
      alvo.push(...criados);
      return { data: um ? criados[0] : retorna ? criados : null, error: null };
    }
    if (op === "update" && antesDoUpdate) {
      const f = antesDoUpdate;
      antesDoUpdate = null;
      f();
    }
    const afetadas = alvo.filter(casa);
    if (op === "update") {
      const campos = payload as Record<string, unknown>;
      if (tabela === "ab_testes" && campos.status === "ativo") {
        for (const t of afetadas) {
          const links = bd.ab_variantes.filter((v) => v.teste_id === t.id).map((v) => v.link_id);
          const conflito = bd.ab_testes.some(
            (o) =>
              o.id !== t.id &&
              o.status === "ativo" &&
              bd.ab_variantes.some((v) => v.teste_id === o.id && links.includes(v.link_id as string)),
          );
          if (conflito) return { data: null, error: { code: "23505", message: ERRO_PAGINA } };
        }
      }
      afetadas.forEach((l) => Object.assign(l, campos));
      return { data: retorna ? afetadas.map((l) => ({ id: l.id })) : null, error: null };
    }
    // delete (cascata das variantes quando o teste sai)
    bd[tabela] = alvo.filter((l) => !afetadas.includes(l)) as never;
    if (tabela === "ab_testes") {
      bd.ab_variantes = bd.ab_variantes.filter((v) => !afetadas.some((t) => t.id === v.teste_id));
    }
    return { data: null, error: null };
  };

  q.select = () => {
    if (op !== "select") retorna = true;
    return q;
  };
  q.insert = (p: unknown) => {
    op = "insert";
    payload = p;
    return q;
  };
  q.update = (p: unknown) => {
    op = "update";
    payload = p;
    return q;
  };
  q.delete = () => {
    op = "delete";
    return q;
  };
  q.eq = (c: string, v: unknown) => {
    eqs.push([c, v]);
    return q;
  };
  q.in = (c: string, v: unknown[]) => {
    ins = [c, v];
    return q;
  };
  q.order = () => q;
  q.single = () => {
    um = "single";
    return q;
  };
  q.maybeSingle = () => {
    um = "maybe";
    return q;
  };
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko);
  return q;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: (t: keyof typeof bd) => construtor(t) })),
}));

import { GET, POST } from "../route";

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";
const L3 = "33333333-3333-4333-8333-333333333333";
const LH = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
const L_RED = "44444444-4444-4444-8444-444444444444";
const L_DEL = "55555555-5555-4555-8555-555555555555";
const INEXISTENTE = "99999999-9999-4999-8999-999999999999";

const validos = {
  nome: "  Título novo  ",
  variantes: [
    { link_id: L1, rotulo: "A", controle: true },
    { link_id: L2, rotulo: "B" },
  ],
};

function req(corpo: unknown) {
  return new NextRequest("http://localhost/api/central-de-links/ab-testes", {
    method: "POST",
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    headers: { "content-type": "application/json" },
  });
}
const chamar = (corpo: unknown) => POST(req(corpo));

function papel(p: "admin" | "membro" | null) {
  mockExigir.mockImplementation(async (minimo: "membro" | "admin") => {
    if (p === null) {
      return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null, papel: null };
    }
    if (minimo === "admin" && p !== "admin") {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: "u", papel: p };
    }
    return { error: null, userId: "u", papel: p };
  });
}

function semeiaTeste(status: string, links: string[] = [L1, L2], id: string = novoId()) {
  bd.ab_testes.push({ id, nome: "Existente", status });
  links.forEach((l, i) =>
    bd.ab_variantes.push({ id: novoId(), teste_id: id, link_id: l, rotulo: "RT" + i, controle: i === 0 }),
  );
  return id;
}

beforeEach(() => {
  bd.ab_testes = [];
  bd.ab_variantes = [];
  bd.central_links = [
    { id: L1, label: "Página 1", tipo: "cap", deleted: false },
    { id: L2, label: "Página 2", tipo: "cap", deleted: false },
    { id: L3, label: "Página 3", tipo: "cap", deleted: false },
    { id: L_RED, label: "Redirect", tipo: "redirect", deleted: false },
    { id: L_DEL, label: "Apagada", tipo: "cap", deleted: true },
  ];
  chamadas.length = 0;
  falhaInsert = null;
  antesDoUpdate = null;
  seq = 0;
  mockExigir.mockReset();
  papel("admin");
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function json(r: Response) {
  return (await r.json()) as Record<string, any>;
}

describe("autorização", () => {
  it("sem sessão: 401 em listar (POST e GET) e em criar", async () => {
    papel(null);
    expect((await chamar({ acao: "listar" })).status).toBe(401);
    expect((await chamar({ acao: "criar", ...validos })).status).toBe(401);
    expect((await GET()).status).toBe(401);
    expect(bd.ab_testes).toHaveLength(0);
  });

  it("membro lista (POST e GET), mas não escreve: 403 em todas as demais ações", async () => {
    papel("membro");
    const id = semeiaTeste("rascunho");
    expect((await chamar({ acao: "listar" })).status).toBe(200);
    expect((await GET()).status).toBe(200);
    for (const acao of ["criar", "editar", "iniciar", "encerrar", "excluir"]) {
      expect((await chamar({ acao, id, ...validos })).status).toBe(403);
    }
    expect(bd.ab_testes).toHaveLength(1);
    expect(bd.ab_testes[0].status).toBe("rascunho");
    expect(bd.ab_variantes).toHaveLength(2);
  });

  it("pede o papel certo: listar = membro; escrever = admin; reconsulta a cada chamada", async () => {
    await chamar({ acao: "listar" });
    expect(mockExigir).toHaveBeenLastCalledWith("membro");
    await chamar({ acao: "criar", ...validos });
    expect(mockExigir).toHaveBeenLastCalledWith("admin");
    expect(mockExigir).toHaveBeenCalledTimes(2);
  });

  it("ação desconhecida e corpo inválido: 400; respostas sem cache", async () => {
    const a = await chamar({ acao: "hackear" });
    expect(a.status).toBe(400);
    expect(await json(a)).toEqual({ erro: "Ação desconhecida." });
    expect(await json(await chamar({ acao: "toString" }))).toEqual({ erro: "Ação desconhecida." });
    const b = await chamar("{nao-json");
    expect(b.status).toBe(400);
    expect(await json(b)).toEqual({ erro: "Corpo da requisição inválido." });
    expect(a.headers.get("cache-control")).toBe("no-store");
    expect((await GET()).headers.get("cache-control")).toBe("no-store");
  });
});

describe("listar", () => {
  it("devolve { testes } com variantes aninhadas e links", async () => {
    semeiaTeste("rascunho");
    const j = await json(await chamar({ acao: "listar" }));
    expect(j.testes).toHaveLength(1);
    expect(j.testes[0].ab_variantes).toHaveLength(2);
    expect(j.testes[0].ab_variantes[0].central_links.label).toBe("Página 1");
  });

  it("sem testes: { testes: [] }", async () => {
    expect(await json(await GET())).toEqual({ testes: [] });
  });
});

describe("criar", () => {
  it("cria rascunho com variantes limpas e devolve { teste }", async () => {
    const r = await chamar({ acao: "criar", ...validos });
    expect(r.status).toBe(200);
    const { teste } = await json(r);
    expect(teste.nome).toBe("Título novo");
    expect(teste.status).toBe("rascunho");
    expect(teste.ab_variantes).toHaveLength(2);
    expect(teste.ab_variantes.find((v: any) => v.rotulo === "A").controle).toBe(true);
    expect(teste.ab_variantes.find((v: any) => v.rotulo === "B").controle).toBe(false);
  });

  const invalidos: [string, unknown, string][] = [
    ["nome vazio", { ...validos, nome: "   " }, "Informe o nome do teste."],
    ["nome com 121", { ...validos, nome: "x".repeat(121) }, "O nome do teste pode ter no máximo 120 caracteres."],
    ["1 variante", { ...validos, variantes: [validos.variantes[0]] }, "Escolha pelo menos 2 páginas para comparar."],
    ["sem variantes", { nome: "x" }, "Escolha pelo menos 2 páginas para comparar."],
    [
      "9 variantes",
      {
        nome: "x",
        variantes: Array.from({ length: 9 }, (_, i) => ({
          link_id: `0000000${i}-0000-4000-8000-000000000000`,
          rotulo: "R" + i,
          controle: i === 0,
        })),
      },
      "Um teste pode ter no máximo 8 variantes.",
    ],
    [
      "link não uuid",
      { ...validos, variantes: [{ link_id: "abc", rotulo: "A", controle: true }, validos.variantes[1]] },
      "Página inválida em uma das variantes.",
    ],
    [
      "rótulo vazio",
      { ...validos, variantes: [{ link_id: L1, rotulo: " ", controle: true }, validos.variantes[1]] },
      "Cada variante precisa de um rótulo (A, B, C…).",
    ],
    [
      "rótulo com 21",
      { ...validos, variantes: [{ link_id: L1, rotulo: "x".repeat(21), controle: true }, validos.variantes[1]] },
      "O rótulo da variante pode ter no máximo 20 caracteres.",
    ],
    [
      "link repetido (caixa diferente)",
      {
        ...validos,
        variantes: [
          { link_id: LH, rotulo: "A", controle: true },
          { link_id: LH.toUpperCase(), rotulo: "B" },
        ],
      },
      "A mesma página não pode aparecer duas vezes no teste.",
    ],
    [
      "rótulo repetido (caixa diferente)",
      {
        ...validos,
        variantes: [
          { link_id: L1, rotulo: "a", controle: true },
          { link_id: L2, rotulo: "A" },
        ],
      },
      "Os rótulos das variantes precisam ser diferentes.",
    ],
    [
      "nenhum controle",
      { ...validos, variantes: [{ link_id: L1, rotulo: "A" }, { link_id: L2, rotulo: "B" }] },
      "Marque exatamente uma variante como controle.",
    ],
    [
      "dois controles",
      {
        ...validos,
        variantes: [
          { link_id: L1, rotulo: "A", controle: true },
          { link_id: L2, rotulo: "B", controle: true },
        ],
      },
      "Marque exatamente uma variante como controle.",
    ],
    [
      "controle só vale com true estrito",
      {
        ...validos,
        variantes: [
          { link_id: L1, rotulo: "A", controle: "true" },
          { link_id: L2, rotulo: "B" },
        ],
      },
      "Marque exatamente uma variante como controle.",
    ],
  ];

  it.each(invalidos)("400: %s", async (_n, corpo, msg) => {
    const r = await chamar({ acao: "criar", ...(corpo as object) });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: msg });
    expect(bd.ab_testes).toHaveLength(0);
  });

  it("aceita 8 variantes, rótulo de 20 e nome de 120 (limites inclusivos)", async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `0000000${i}-0000-4000-8000-000000000000`);
    ids.forEach((id, i) => bd.central_links.push({ id, label: "P" + i, tipo: "cap", deleted: false }));
    const r = await chamar({
      acao: "criar",
      nome: "x".repeat(120),
      variantes: ids.map((id, i) => ({ link_id: id, rotulo: i === 0 ? "r".repeat(20) : "R" + i, controle: i === 0 })),
    });
    expect(r.status).toBe(200);
  });

  it("400 se a página não existe, está excluída ou não é do tipo cap", async () => {
    const mk = (id: string) => ({ ...validos, variantes: [validos.variantes[0], { link_id: id, rotulo: "B" }] });
    for (const id of [INEXISTENTE, L_DEL]) {
      const r = await chamar({ acao: "criar", ...mk(id) });
      expect(r.status).toBe(400);
      expect(await json(r)).toEqual({ erro: "Uma das páginas escolhidas não existe mais." });
    }
    const r = await chamar({ acao: "criar", ...mk(L_RED) });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: 'A página "Redirect" não é uma página de captura.' });
    expect(bd.ab_testes).toHaveLength(0);
  });

  it("falha ao gravar variantes: apaga o teste recém-criado e responde o erro", async () => {
    falhaInsert = { erro: { code: "XX000", message: "boom" }, vezes: 1 };
    const r = await chamar({ acao: "criar", ...validos });
    expect(r.status).toBe(500);
    expect(await json(r)).toEqual({ erro: "Erro ao acessar o banco de dados." });
    expect(bd.ab_testes).toHaveLength(0);
  });

  it("rótulo repetido barrado pelo banco (23505): 409 com a mensagem em português, sem sobra", async () => {
    falhaInsert = { erro: { code: "23505", message: ERRO_ROTULO }, vezes: 1 };
    const r = await chamar({ acao: "criar", ...validos });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: ERRO_ROTULO });
    expect(bd.ab_testes).toHaveLength(0);
  });

  it("23505 sem mensagem usa o texto padrão", async () => {
    falhaInsert = { erro: { code: "23505" }, vezes: 1 };
    const r = await chamar({ acao: "criar", ...validos });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: "Já existe um registro igual a este." });
  });
});

describe("editar", () => {
  it("troca nome e variantes de um rascunho", async () => {
    const id = semeiaTeste("rascunho");
    const r = await chamar({
      acao: "editar",
      id,
      nome: "Novo nome",
      variantes: [
        { link_id: L2, rotulo: "X", controle: true },
        { link_id: L3, rotulo: "Y" },
      ],
    });
    expect(r.status).toBe(200);
    const { teste } = await json(r);
    expect(teste.nome).toBe("Novo nome");
    expect(teste.ab_variantes.map((v: any) => v.rotulo).sort()).toEqual(["X", "Y"]);
  });

  it("409 se não for rascunho (ativo e encerrado)", async () => {
    for (const st of ["ativo", "encerrado"]) {
      const id = semeiaTeste(st, [L3]);
      const r = await chamar({ acao: "editar", id, ...validos });
      expect(r.status).toBe(409);
      expect(await json(r)).toEqual({ erro: "Só é possível editar um teste que ainda não foi iniciado." });
    }
  });

  it("400 id inválido; 404 inexistente; dados inválidos não tocam nas variantes", async () => {
    const ruim = await chamar({ acao: "editar", id: "x", ...validos });
    expect(ruim.status).toBe(400);
    expect(await json(ruim)).toEqual({ erro: "Teste inválido." });
    const nf = await chamar({ acao: "editar", id: INEXISTENTE, ...validos });
    expect(nf.status).toBe(404);
    expect(await json(nf)).toEqual({ erro: "Teste não encontrado." });
    const id = semeiaTeste("rascunho");
    const r = await chamar({ acao: "editar", id, nome: "" });
    expect(r.status).toBe(400);
    expect(bd.ab_variantes.filter((v) => v.teste_id === id)).toHaveLength(2);
  });

  it("falha ao regravar (23505): devolve as variantes anteriores, com os mesmos ids, e responde 409", async () => {
    const id = semeiaTeste("rascunho");
    const antes = bd.ab_variantes.map((v) => ({ ...v }));
    falhaInsert = { erro: { code: "23505", message: ERRO_ROTULO }, vezes: 1 };
    const r = await chamar({ acao: "editar", id, nome: "Outro", variantes: validos.variantes });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: ERRO_ROTULO });
    const depois = bd.ab_variantes.filter((v) => v.teste_id === id);
    expect(depois.map((v) => v.id).sort()).toEqual(antes.map((v) => v.id).sort());
    expect(depois.map((v) => v.rotulo).sort()).toEqual(["RT0", "RT1"]);
    expect(bd.ab_testes[0].nome).toBe("Existente");
  });
});

describe("iniciar", () => {
  it("rascunho vira ativo com iniciado_em", async () => {
    const id = semeiaTeste("rascunho");
    const r = await chamar({ acao: "iniciar", id });
    expect(r.status).toBe(200);
    const { teste } = await json(r);
    expect(teste.status).toBe("ativo");
    expect(typeof teste.iniciado_em).toBe("string");
  });

  it("filtra o update por status=rascunho (anti-corrida)", async () => {
    const id = semeiaTeste("rascunho");
    await chamar({ acao: "iniciar", id });
    const up = chamadas.find((c) => c.op === "update");
    expect(up?.filtros).toEqual(expect.arrayContaining([`id=${id}`, "status=rascunho"]));
  });

  it("409 se já iniciado/encerrado", async () => {
    for (const st of ["ativo", "encerrado"]) {
      const id = semeiaTeste(st, [L3]);
      const r = await chamar({ acao: "iniciar", id });
      expect(r.status).toBe(409);
      expect(await json(r)).toEqual({ erro: "Este teste já foi iniciado ou encerrado." });
    }
  });

  it("400 com menos de 2 variantes", async () => {
    const id = semeiaTeste("rascunho", [L1]);
    const r = await chamar({ acao: "iniciar", id });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: "O teste precisa de pelo menos 2 páginas para ser iniciado." });
  });

  it("400 sem controle e 400 com dois controles", async () => {
    const id = semeiaTeste("rascunho");
    const vs = bd.ab_variantes.filter((v) => v.teste_id === id);
    vs.forEach((v) => (v.controle = false));
    const r = await chamar({ acao: "iniciar", id });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: "Marque uma variante como controle antes de iniciar." });
    vs.forEach((v) => (v.controle = true));
    expect((await chamar({ acao: "iniciar", id })).status).toBe(400);
    expect(bd.ab_testes[0].status).toBe("rascunho");
  });

  it("400 se uma página do teste foi excluída depois de montar o rascunho", async () => {
    const id = semeiaTeste("rascunho");
    bd.central_links.find((l) => l.id === L2)!.deleted = true;
    const r = await chamar({ acao: "iniciar", id });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: "Uma das páginas escolhidas não existe mais." });
    expect(bd.ab_testes[0].status).toBe("rascunho");
  });

  it("409 com a mensagem do gatilho quando a página já está em outro teste ativo", async () => {
    semeiaTeste("ativo", [L1, L3]);
    const id = semeiaTeste("rascunho", [L1, L2]);
    const r = await chamar({ acao: "iniciar", id });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: ERRO_PAGINA });
    expect(bd.ab_testes.find((t) => t.id === id)!.status).toBe("rascunho");
  });

  it("409 se outra chamada iniciou no meio (update não afeta nenhuma linha)", async () => {
    const id = semeiaTeste("rascunho");
    antesDoUpdate = () => {
      bd.ab_testes.find((t) => t.id === id)!.status = "ativo";
    };
    const r = await chamar({ acao: "iniciar", id });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: "Este teste já foi iniciado ou encerrado." });
  });
});

describe("encerrar", () => {
  function ativo() {
    const id = semeiaTeste("ativo");
    return { id, vs: bd.ab_variantes.filter((v) => v.teste_id === id) };
  }

  it("com vencedor (id em qualquer caixa) e anotação aparada", async () => {
    const { id, vs } = ativo();
    const r = await chamar({
      acao: "encerrar",
      id,
      vencedor_variante: vs[1].id.toUpperCase(),
      anotacao: "  B ganhou  ",
    });
    expect(r.status).toBe(200);
    const { teste } = await json(r);
    expect(teste.status).toBe("encerrado");
    expect(teste.vencedor_variante).toBe(vs[1].id);
    expect(teste.anotacao).toBe("B ganhou");
    expect(typeof teste.encerrado_em).toBe("string");
  });

  it('"sem diferença": vencedor vazio vira null e anotação vazia vira null', async () => {
    const { id } = ativo();
    const { teste } = await json(await chamar({ acao: "encerrar", id, vencedor_variante: "", anotacao: "   " }));
    expect(teste.status).toBe("encerrado");
    expect(teste.vencedor_variante).toBeNull();
    expect(teste.anotacao).toBeNull();
  });

  it("sem os campos: encerra como sem diferença", async () => {
    const { id } = ativo();
    const { teste } = await json(await chamar({ acao: "encerrar", id }));
    expect(teste.status).toBe("encerrado");
    expect(teste.vencedor_variante).toBeNull();
  });

  it("400 se o vencedor é de outro teste", async () => {
    const { id } = ativo();
    const outro = semeiaTeste("rascunho", [L3, L_RED]);
    const alheia = bd.ab_variantes.find((v) => v.teste_id === outro)!;
    const r = await chamar({ acao: "encerrar", id, vencedor_variante: alheia.id });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: "A variante vencedora não pertence a este teste." });
    expect(bd.ab_testes.find((t) => t.id === id)!.status).toBe("ativo");
  });

  it("anotação: 2000 passa, 2001 dá 400", async () => {
    const { id } = ativo();
    const r = await chamar({ acao: "encerrar", id, anotacao: "x".repeat(2001) });
    expect(r.status).toBe(400);
    expect(await json(r)).toEqual({ erro: "A anotação pode ter no máximo 2000 caracteres." });
    expect((await chamar({ acao: "encerrar", id, anotacao: "x".repeat(2000) })).status).toBe(200);
  });

  it("409 se não está ativo (rascunho e encerrado)", async () => {
    for (const st of ["rascunho", "encerrado"]) {
      const id = semeiaTeste(st, [L3]);
      const r = await chamar({ acao: "encerrar", id });
      expect(r.status).toBe(409);
      expect(await json(r)).toEqual({ erro: "Só é possível encerrar um teste que está em andamento." });
    }
  });

  it("filtra o update por status=ativo (anti-corrida) e 409 se perdeu a corrida", async () => {
    const { id } = ativo();
    antesDoUpdate = () => {
      bd.ab_testes.find((t) => t.id === id)!.status = "encerrado";
    };
    const r = await chamar({ acao: "encerrar", id });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: "Só é possível encerrar um teste que está em andamento." });
    const up = chamadas.find((c) => c.op === "update");
    expect(up?.filtros).toEqual(expect.arrayContaining([`id=${id}`, "status=ativo"]));
  });
});

describe("excluir", () => {
  it("exclui rascunho sem confirmar, levando as variantes", async () => {
    const id = semeiaTeste("rascunho");
    const r = await chamar({ acao: "excluir", id });
    expect(r.status).toBe(200);
    expect(await json(r)).toEqual({ ok: true });
    expect(bd.ab_testes).toHaveLength(0);
    expect(bd.ab_variantes).toHaveLength(0);
  });

  it("409 se ativo, mesmo com confirmar", async () => {
    const id = semeiaTeste("ativo");
    const r = await chamar({ acao: "excluir", id, confirmar: true });
    expect(r.status).toBe(409);
    expect(await json(r)).toEqual({ erro: "Encerre o teste antes de excluí-lo." });
    expect(bd.ab_testes).toHaveLength(1);
  });

  it("encerrado exige confirmar === true", async () => {
    const id = semeiaTeste("encerrado");
    for (const confirmar of [undefined, false, "true", 1]) {
      const r = await chamar({ acao: "excluir", id, confirmar });
      expect(r.status).toBe(400);
      expect(await json(r)).toEqual({
        erro: "Excluir um teste encerrado apaga todo o histórico dele. Confirme a exclusão.",
      });
    }
    expect(bd.ab_testes).toHaveLength(1);
    expect((await chamar({ acao: "excluir", id, confirmar: true })).status).toBe(200);
    expect(bd.ab_testes).toHaveLength(0);
  });
});

describe("erros inesperados", () => {
  it("exceção qualquer vira 500 genérico, sem vazar detalhe", async () => {
    mockExigir.mockImplementation(async () => {
      throw new Error("segredo interno");
    });
    const r = await chamar({ acao: "listar" });
    expect(r.status).toBe(500);
    expect(await json(r)).toEqual({ erro: "Erro interno." });
  });
});
