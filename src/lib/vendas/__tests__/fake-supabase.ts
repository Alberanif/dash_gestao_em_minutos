// Fake encadeável do client Supabase para testes de rota: grava cada chamada
// (tabela, operação, payload, filtros) e deixa o teste decidir o resultado.
export interface FakeCall {
  table?: string;
  rpc?: string;
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  payload?: unknown;
  options?: unknown;
  filters: Array<[string, unknown[]]>;
  single?: "single" | "maybeSingle";
}
export interface FakeResult {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export function createFakeSupabase(resolver: (call: FakeCall) => FakeResult) {
  const calls: FakeCall[] = [];

  function run(call: FakeCall): FakeResult {
    calls.push(call);
    const r = resolver(call) ?? {};
    return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
  }

  function builder(call: FakeCall) {
    const b: Record<string, unknown> = {};
    const chain = (name: string) => (...args: unknown[]) => {
      call.filters.push([name, args]);
      return b;
    };
    for (const m of ["eq", "or", "order", "in", "abortSignal", "select"]) b[m] = chain(m);
    b.single = () => ((call.single = "single"), b);
    b.maybeSingle = () => ((call.single = "maybeSingle"), b);
    b.then = (resolve: (v: FakeResult) => unknown, reject?: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(run(call)).then(resolve, reject);
      } catch (e) {
        return Promise.reject(e).then(resolve, reject);
      }
    };
    return b;
  }

  const client = {
    from: (table: string) => {
      const start = (op: FakeCall["op"]) => (payload?: unknown, options?: unknown) =>
        builder({ table, op, payload, options, filters: [] });
      return {
        select: (cols?: string) => builder({ table, op: "select", payload: cols, filters: [] }),
        insert: start("insert"),
        update: start("update"),
        delete: () => builder({ table, op: "delete", filters: [] }),
        upsert: start("upsert"),
      };
    },
    rpc: (fn: string, args: unknown) => builder({ rpc: fn, op: "rpc", payload: args, filters: [] }),
  };
  return { client, calls };
}

export const filterOf = (c: FakeCall, name: string) =>
  c.filters.find(([n]) => n === name)?.[1];
