import { loadContaPrincipal, loadEventosSeletor } from "../seletor-eventos";

/**
 * Paridade com o que a tela Eventos do V1 obtém no navegador: `GET /api/accounts`
 * (lista por created_at asc, usa `[0]`) e `GET /api/indicadores/filters`.
 * `legacyEventos` reproduz essas duas consultas sobre o mesmo banco falso.
 */

type Result = { data: unknown; error: { message: string } | null };

/** Banco falso por tabela, com `eq` e `order` de fato aplicados. */
function makeClient(tables: Record<string, Result & { rows?: Array<Record<string, unknown>> }>) {
  const calls: Array<[string, unknown[]]> = [];
  function from(table: string) {
    calls.push(["from", [table]]);
    const t = tables[table];
    let rows = [...(t.rows ?? [])];
    const chain: Record<string, unknown> = {};
    chain.select = (...args: unknown[]) => {
      calls.push(["select", args]);
      return chain;
    };
    chain.eq = (col: string, value: unknown) => {
      calls.push(["eq", [col, value]]);
      rows = rows.filter((r) => r[col] === value);
      return chain;
    };
    chain.order = (col: string, opts: { ascending: boolean }) => {
      calls.push(["order", [col, opts]]);
      rows.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (opts.ascending ? 1 : -1));
      return Promise.resolve(t.error ? { data: null, error: t.error } : { data: t.rows ? rows : t.data, error: null });
    };
    return chain;
  }
  return { client: { from }, calls };
}

const contas = [
  { id: "acc-novo", created_at: "2026-09-01" },
  { id: "acc-antigo", created_at: "2026-01-01" },
];
const filtros = [
  { id: "f2", account_id: "acc-antigo", name: "B evento" },
  { id: "f1", account_id: "acc-antigo", name: "A evento" },
  { id: "f9", account_id: "acc-novo", name: "De outra conta" },
];

function tabelas(over: Partial<Record<string, Result & { rows?: Array<Record<string, unknown>> }>> = {}) {
  return {
    dash_gestao_accounts: { rows: contas, data: null, error: null },
    dash_gestao_filters: { rows: filtros, data: null, error: null },
    ...over,
  } as Parameters<typeof makeClient>[0];
}

/** O que o navegador fazia: contas por created_at asc, `[0].id`, filtros dessa conta por nome. */
async function legacyEventos(client: ReturnType<typeof makeClient>["client"]) {
  const accounts = await (client.from("dash_gestao_accounts") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("*")
    .order("created_at", { ascending: true });
  if (!Array.isArray(accounts.data) || accounts.data.length === 0) return { accountId: null, filters: [] };
  const accountId = accounts.data[0].id;
  const filters = await (client.from("dash_gestao_filters") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("*")
    .eq("account_id", accountId)
    .order("name", { ascending: true });
  return { accountId, filters: filters.data };
}

describe("loadEventosSeletor — paridade com accounts[0] + GET /filters", () => {
  it("usa a conta mais antiga e devolve só os filtros dela, ordenados por nome", async () => {
    const novo = makeClient(tabelas());
    const antigo = makeClient(tabelas());

    const res = await loadEventosSeletor(novo.client);
    const ref = await legacyEventos(antigo.client);

    expect(res).toEqual({ data: ref });
    expect(res.data?.accountId).toBe("acc-antigo");
    expect(res.data?.filters.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("consulta contas por created_at crescente e filtros por conta e nome", async () => {
    const { client, calls } = makeClient(tabelas());
    await loadEventosSeletor(client);

    expect(calls).toContainEqual(["order", ["created_at", { ascending: true }]]);
    expect(calls).toContainEqual(["eq", ["account_id", "acc-antigo"]]);
    expect(calls).toContainEqual(["order", ["name", { ascending: true }]]);
  });

  it("sem conta cadastrada: lista vazia e não consulta filtros", async () => {
    const { client, calls } = makeClient(tabelas({ dash_gestao_accounts: { rows: [], data: null, error: null } }));
    const antigo = makeClient(tabelas({ dash_gestao_accounts: { rows: [], data: null, error: null } }));

    expect(await loadEventosSeletor(client)).toEqual({ data: await legacyEventos(antigo.client) });
    expect(calls.filter(([n, a]) => n === "from" && a[0] === "dash_gestao_filters")).toEqual([]);
  });

  it("erro ao ler contas vira { error } com a mensagem do banco", async () => {
    const { client } = makeClient(tabelas({ dash_gestao_accounts: { data: null, error: { message: "contas fora" } } }));
    expect(await loadEventosSeletor(client)).toEqual({ error: "contas fora" });
  });

  it("erro ao ler filtros vira { error } com a mensagem do banco", async () => {
    const { client } = makeClient(tabelas({ dash_gestao_filters: { data: null, error: { message: "filtros fora" } } }));
    expect(await loadEventosSeletor(client)).toEqual({ error: "filtros fora" });
  });
});

describe("loadContaPrincipal", () => {
  it("devolve null quando a lista de contas é vazia", async () => {
    const { client } = makeClient(tabelas({ dash_gestao_accounts: { rows: [], data: null, error: null } }));
    expect(await loadContaPrincipal(client)).toEqual({ data: null });
  });
});
