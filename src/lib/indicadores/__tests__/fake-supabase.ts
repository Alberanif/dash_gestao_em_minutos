/**
 * Fake do query builder do Supabase. Registra os filtros que chegaram em cada
 * consulta, para que os testes possam afirmar sobre o *parâmetro que chega no
 * banco* — e não sobre a chamada de fetch, que foi justamente o que deixou o
 * bug do `filter_id` fantasma passar despercebido.
 */
export interface RecordedQuery {
  table: string;
  select: string | null;
  eq: Array<[string, unknown]>;
  in: Array<[string, unknown[]]>;
  neq: Array<[string, unknown]>;
  gte: Array<[string, unknown]>;
  lte: Array<[string, unknown]>;
  or: string[];
  range: Array<[number, number]> ;
}

export interface RecordedRpc {
  fn: string;
  args: Record<string, unknown>;
}

type Row = Record<string, unknown>;

type QueryResult = { data: Row[] | null; error: { message: string } | null };

/** Builder encadeável, do mesmo formato do postgrest-js e aguardável como ele. */
interface FakeQueryBuilder extends PromiseLike<QueryResult> {
  select(cols: string): FakeQueryBuilder;
  eq(col: string, value: unknown): FakeQueryBuilder;
  in(col: string, values: unknown[]): FakeQueryBuilder;
  neq(col: string, value: unknown): FakeQueryBuilder;
  gte(col: string, value: unknown): FakeQueryBuilder;
  lte(col: string, value: unknown): FakeQueryBuilder;
  or(expr: string): FakeQueryBuilder;
  range(from: number, to: number): Promise<QueryResult>;
}

interface FakeClient {
  from(table: string): FakeQueryBuilder;
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface FakeSupabase {
  client: FakeClient;
  queriesFor(table: string): RecordedQuery[];
  rpcCalls(fn?: string): RecordedRpc[];
  setRows(table: string, rows: Row[]): void;
  setError(table: string, message: string): void;
  setRpc(fn: string, data: unknown): void;
  setRpcError(fn: string, message: string): void;
}

export function makeFakeSupabase(): FakeSupabase {
  const queries: RecordedQuery[] = [];
  const rpcs: RecordedRpc[] = [];
  const rowsByTable = new Map<string, Row[]>();
  const errorsByTable = new Map<string, string>();
  const rpcData = new Map<string, unknown>();
  const rpcErrors = new Map<string, string>();

  function matches(query: RecordedQuery, row: Row): boolean {
    for (const [col, value] of query.eq) {
      if (row[col] !== value) return false;
    }
    for (const [col, values] of query.in) {
      if (!values.includes(row[col] as never)) return false;
    }
    for (const [col, value] of query.neq) {
      if (row[col] === value) return false;
    }
    return true;
  }

  function makeBuilder(table: string): FakeQueryBuilder {
    const query: RecordedQuery = {
      table,
      select: null,
      eq: [],
      in: [],
      neq: [],
      gte: [],
      lte: [],
      or: [],
      range: [],
    };
    queries.push(query);

    // Como o PostgREST real: sem .range() a resposta é truncada em 1000 linhas
    // (max-rows padrão), silenciosamente. Com .range(), devolve a fatia pedida.
    const resolve = (slice?: [number, number]): Promise<QueryResult> => {
      const message = errorsByTable.get(table);
      if (message) return Promise.resolve({ data: null, error: { message } });
      const rows = (rowsByTable.get(table) ?? []).filter((r) => matches(query, r));
      const data = slice ? rows.slice(slice[0], slice[1] + 1) : rows.slice(0, 1000);
      return Promise.resolve({ data, error: null });
    };

    const builder: FakeQueryBuilder = {
      select(cols: string) {
        query.select = cols;
        return builder;
      },
      eq(col: string, value: unknown) {
        query.eq.push([col, value]);
        return builder;
      },
      in(col: string, values: unknown[]) {
        query.in.push([col, values]);
        return builder;
      },
      neq(col: string, value: unknown) {
        query.neq.push([col, value]);
        return builder;
      },
      gte(col: string, value: unknown) {
        query.gte.push([col, value]);
        return builder;
      },
      lte(col: string, value: unknown) {
        query.lte.push([col, value]);
        return builder;
      },
      or(expr: string) {
        query.or.push(expr);
        return builder;
      },
      range(from: number, to: number) {
        query.range.push([from, to]);
        return resolve([from, to]);
      },
      then(onFulfilled, onRejected) {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  const client: FakeClient = {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string, args: Record<string, unknown> = {}) => {
      rpcs.push({ fn, args });
      const message = rpcErrors.get(fn);
      if (message) return Promise.resolve({ data: null, error: { message } });
      return Promise.resolve({ data: rpcData.get(fn) ?? null, error: null });
    },
  };

  return {
    client,
    queriesFor: (table) => queries.filter((q) => q.table === table),
    rpcCalls: (fn) => (fn ? rpcs.filter((r) => r.fn === fn) : rpcs),
    setRows: (table, rows) => rowsByTable.set(table, rows),
    setError: (table, message) => errorsByTable.set(table, message),
    setRpc: (fn, data) => rpcData.set(fn, data),
    setRpcError: (fn, message) => rpcErrors.set(fn, message),
  };
}
