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
  lt: Array<[string, unknown]>;
  or: string[];
  range: Array<[number, number]> ;
  /** Operação de escrita, se houver: insert/update/upsert (default é leitura). */
  op: "select" | "insert" | "update" | "upsert";
  /** Payload de insert/upsert; patch de update. */
  payload: Row | Row[] | null;
  /** onConflict/ignoreDuplicates do upsert (PostgREST). */
  onConflict: string | null;
  ignoreDuplicates: boolean;
}

export interface RecordedRpc {
  fn: string;
  args: Record<string, unknown>;
}

type Row = Record<string, unknown>;

type QueryResult = { data: Row[] | null; error: { message: string } | null };
type SingleResult = { data: Row | null; error: { message: string } | null };

/** Builder encadeável, do mesmo formato do postgrest-js e aguardável como ele. */
interface FakeQueryBuilder extends PromiseLike<QueryResult> {
  select(cols?: string): FakeQueryBuilder;
  eq(col: string, value: unknown): FakeQueryBuilder;
  in(col: string, values: unknown[]): FakeQueryBuilder;
  neq(col: string, value: unknown): FakeQueryBuilder;
  gte(col: string, value: unknown): FakeQueryBuilder;
  lte(col: string, value: unknown): FakeQueryBuilder;
  lt(col: string, value: unknown): FakeQueryBuilder;
  or(expr: string): FakeQueryBuilder;
  insert(rows: Row | Row[]): FakeQueryBuilder;
  update(patch: Row): FakeQueryBuilder;
  upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): FakeQueryBuilder;
  range(from: number, to: number): Promise<QueryResult>;
  single(): Promise<SingleResult>;
  maybeSingle(): Promise<SingleResult>;
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
  /** Lê o estado atual das linhas (inspeção pós-escrita nos testes). */
  getRows(table: string): Row[];
  setError(table: string, message: string): void;
  /** `data` pode ser uma função (args) => dados, para respostas que dependem do período pedido. */
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

  /** Compara valores de coluna como número (timestamp/num) quando possível. */
  function lessThan(cell: unknown, value: unknown): boolean {
    if (cell === null || cell === undefined) return false;
    const a = Date.parse(String(cell));
    const b = Date.parse(String(value));
    if (!Number.isNaN(a) && !Number.isNaN(b)) return a < b;
    const na = Number(cell);
    const nb = Number(value);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na < nb;
    return String(cell) < String(value);
  }

  /**
   * Avalia um termo `col.op.value` de um `.or(...)` do PostgREST.
   * "ignore" quando a coluna não existe na linha ou o operador não é suportado
   * (ex.: `ilike`) — preserva o comportamento histórico do fake, que ignorava
   * `.or()` por completo, para as suítes de meta/daily não regredirem. Só
   * operadores realmente suportados (`is`/`lt`/`eq`) filtram de fato.
   */
  function evalOrTerm(row: Row, term: string): "match" | "nomatch" | "ignore" {
    const firstDot = term.indexOf(".");
    const secondDot = term.indexOf(".", firstDot + 1);
    if (firstDot === -1 || secondDot === -1) return "ignore";
    const col = term.slice(0, firstDot);
    const op = term.slice(firstDot + 1, secondDot);
    const rawVal = term.slice(secondDot + 1);
    const present = Object.prototype.hasOwnProperty.call(row, col);
    const cell = row[col];

    switch (op) {
      case "is": {
        if (rawVal === "null") return cell === null || cell === undefined ? "match" : "nomatch";
        if (!present) return "ignore";
        return String(cell) === rawVal ? "match" : "nomatch";
      }
      case "lt":
        if (!present || cell === null || cell === undefined) return "ignore";
        return lessThan(cell, rawVal) ? "match" : "nomatch";
      case "eq":
        if (!present) return "ignore";
        return String(cell) === rawVal ? "match" : "nomatch";
      default:
        return "ignore"; // ilike e demais operadores não suportados: ignorados
    }
  }

  /** Grupo `.or(...)`: casa se algum termo casa; falha só se há termo avaliável sem casar. */
  function matchesOrGroup(row: Row, expr: string): boolean {
    let sawEvaluable = false;
    for (const term of expr.split(",")) {
      const result = evalOrTerm(row, term);
      if (result === "match") return true;
      if (result === "nomatch") sawEvaluable = true;
    }
    return !sawEvaluable; // todos ignorados ⇒ passa (comportamento histórico)
  }

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
    for (const [col, value] of query.lt) {
      if (!lessThan(row[col], value)) return false;
    }
    // Cada .or() é um grupo OR próprio; grupos distintos são AND entre si.
    for (const expr of query.or) {
      if (!matchesOrGroup(row, expr)) return false;
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
      lt: [],
      or: [],
      range: [],
      op: "select",
      payload: null,
      onConflict: null,
      ignoreDuplicates: false,
    };
    queries.push(query);

    const currentRows = (): Row[] => {
      let rows = rowsByTable.get(table);
      if (!rows) {
        rows = [];
        rowsByTable.set(table, rows);
      }
      return rows;
    };

    function applyWrite(): Row[] {
      const rows = currentRows();

      if (query.op === "insert") {
        const payload = Array.isArray(query.payload) ? query.payload : [query.payload as Row];
        const inserted = payload.map((r) => ({ ...r }));
        rows.push(...inserted);
        return inserted;
      }

      if (query.op === "upsert") {
        const payload = Array.isArray(query.payload) ? query.payload : [query.payload as Row];
        const affected: Row[] = [];
        for (const incoming of payload) {
          const conflictCol = query.onConflict;
          const existing = conflictCol
            ? rows.find((r) => r[conflictCol] === incoming[conflictCol])
            : undefined;
          if (existing) {
            if (query.ignoreDuplicates) continue; // on-conflict-do-nothing
            Object.assign(existing, incoming);
            affected.push(existing);
          } else {
            const created = { ...incoming };
            rows.push(created);
            affected.push(created);
          }
        }
        return affected;
      }

      // update: aplica o patch nas linhas que casam com os filtros.
      const matched = rows.filter((r) => matches(query, r));
      for (const r of matched) {
        Object.assign(r, query.payload as Row);
      }
      return matched;
    }

    // Como o PostgREST real: sem .range() a resposta é truncada em 1000 linhas
    // (max-rows padrão), silenciosamente. Com .range(), devolve a fatia pedida.
    const resolve = (slice?: [number, number]): Promise<QueryResult> => {
      const message = errorsByTable.get(table);
      if (message) return Promise.resolve({ data: null, error: { message } });

      if (query.op !== "select") {
        const affected = applyWrite();
        // Sem .select() encadeado, PostgREST não devolve linhas (data: null).
        return Promise.resolve({ data: query.select !== null ? affected : null, error: null });
      }

      const rows = (rowsByTable.get(table) ?? []).filter((r) => matches(query, r));
      const data = slice ? rows.slice(slice[0], slice[1] + 1) : rows.slice(0, 1000);
      return Promise.resolve({ data, error: null });
    };

    const resolveSingle = (): Promise<SingleResult> =>
      resolve().then(({ data, error }) => {
        if (error) return { data: null, error };
        const rows = data ?? [];
        return { data: rows.length > 0 ? rows[0] : null, error: null };
      });

    const builder: FakeQueryBuilder = {
      select(cols = "*") {
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
      lt(col: string, value: unknown) {
        query.lt.push([col, value]);
        return builder;
      },
      or(expr: string) {
        query.or.push(expr);
        return builder;
      },
      insert(rows: Row | Row[]) {
        query.op = "insert";
        query.payload = rows;
        return builder;
      },
      update(patch: Row) {
        query.op = "update";
        query.payload = patch;
        return builder;
      },
      upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        query.op = "upsert";
        query.payload = rows;
        query.onConflict = options?.onConflict ?? null;
        query.ignoreDuplicates = options?.ignoreDuplicates ?? false;
        return builder;
      },
      range(from: number, to: number) {
        query.range.push([from, to]);
        return resolve([from, to]);
      },
      single() {
        return resolveSingle();
      },
      maybeSingle() {
        return resolveSingle();
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
      const stored = rpcData.get(fn);
      const data = typeof stored === "function" ? stored(args) : stored;
      return Promise.resolve({ data: data ?? null, error: null });
    },
  };

  return {
    client,
    queriesFor: (table) => queries.filter((q) => q.table === table),
    rpcCalls: (fn) => (fn ? rpcs.filter((r) => r.fn === fn) : rpcs),
    setRows: (table, rows) => rowsByTable.set(table, rows),
    getRows: (table) => rowsByTable.get(table) ?? [],
    setError: (table, message) => errorsByTable.set(table, message),
    setRpc: (fn, data) => rpcData.set(fn, data),
    setRpcError: (fn, message) => rpcErrors.set(fn, message),
  };
}
