/** @jest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { useSixDados } from "../use-six-dados";
import type { SixDadosItem, SixDadosReport } from "@/lib/indicadores/service/six-dados";
import type { AiReportKpiSnapshot } from "@/types/indicadores";

// --- fixtures ---------------------------------------------------------------

function snapshot(): AiReportKpiSnapshot {
  const block = {
    roas: 3.2,
    revenueBrl: 48200,
    leads: 1840,
    cpl: 9,
    spend: 15000,
    sales: 120,
    startDate: "2020-01-01",
    endDate: "2026-07-16",
  };
  return { lifetime: block, last7d: block };
}

function report(text: string, generatedAt = "2026-07-16T10:00:00.000Z"): SixDadosReport {
  return { text, kpiSnapshot: snapshot(), generatedAt };
}

function listItem(overrides: Partial<SixDadosItem> = {}): SixDadosItem {
  return {
    filterId: "f1",
    name: "Evento 1",
    report: report("texto vigente"),
    stale: false,
    ...overrides,
  };
}

/** O item que o POST /generate devolve (mesmo shape do GET). */
function freshItem(filterId: string, text = "resumo novo"): SixDadosItem {
  return { filterId, name: `Evento ${filterId}`, report: report(text), stale: false };
}

// --- fetch mock helpers -----------------------------------------------------

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface FetchCall {
  url: string;
  method: string;
  body: string | undefined;
}

/** Roteia GET /six-dados e POST /generate para handlers distintos. */
function routeFetch(handlers: {
  get: () => Response | Promise<Response>;
  post?: (body: { filterId: string }) => Response | Promise<Response>;
}) {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      return Promise.resolve(handlers.post!(body));
    }
    return Promise.resolve(handlers.get());
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function calls(): FetchCall[] {
  return (global.fetch as jest.Mock).mock.calls.map(([url, init]) => ({
    url: url as string,
    method: ((init?.method as string) ?? "GET").toUpperCase(),
    body: init?.body as string | undefined,
  }));
}

/** Drena microtasks pendentes (fetch + json encadeados). */
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function byId(items: ReturnType<typeof useSixDados>["items"], filterId: string) {
  const found = items.find((i) => i.filterId === filterId);
  if (!found) throw new Error(`card ${filterId} não encontrado`);
  return found;
}

beforeEach(() => {
  jest.resetAllMocks();
});

// --- seam 1 -----------------------------------------------------------------

test("seam 1: monta ⇒ 1 GET; itens não-stale viram ready imediatamente", async () => {
  const items = [
    listItem({ filterId: "f1", name: "E1", stale: false }),
    listItem({ filterId: "f2", name: "E2", stale: false }),
  ];
  routeFetch({ get: () => jsonResponse(items) });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  expect(result.current.items).toHaveLength(2);
  expect(result.current.items.every((i) => i.status === "ready")).toBe(true);
  expect(byId(result.current.items, "f1").reportText).toBe("texto vigente");
  expect(byId(result.current.items, "f1").kpiSnapshot).not.toBeNull();

  const c = calls();
  expect(c).toHaveLength(1);
  expect(c[0].method).toBe("GET");
  expect(c[0].url).toContain("/api/indicadores/six-dados?account_id=acc-1");
});

// --- seam 5 (no POST para não-stale) ---------------------------------------

test("seam 5: nenhum POST /generate para itens não-stale", async () => {
  routeFetch({ get: () => jsonResponse([listItem({ stale: false })]) });

  renderHook(() => useSixDados("acc-1"));
  await flush();

  expect(calls().some((c) => c.method === "POST")).toBe(false);
});

// --- seam 2 (POSTs em paralelo + generating) --------------------------------

test("seam 2: itens stale disparam POSTs em paralelo e ficam generating enquanto pendentes", async () => {
  const items = [
    listItem({ filterId: "f1", name: "E1", stale: true, report: null }),
    listItem({ filterId: "f2", name: "E2", stale: true, report: null }),
  ];
  const p1 = deferred<Response>();
  const p2 = deferred<Response>();
  routeFetch({
    get: () => jsonResponse(items),
    post: (body) => (body.filterId === "f1" ? p1.promise : p2.promise),
  });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  // Os dois POSTs foram disparados juntos, antes de qualquer um resolver.
  const postIds = calls()
    .filter((c) => c.method === "POST")
    .map((c) => JSON.parse(c.body!).filterId)
    .sort();
  expect(postIds).toEqual(["f1", "f2"]);
  expect(result.current.items.every((i) => i.status === "generating")).toBe(true);

  // encerra as promessas pendentes para não vazar
  await act(async () => {
    p1.resolve(jsonResponse(freshItem("f1")));
    p2.resolve(jsonResponse(freshItem("f2")));
    await new Promise((r) => setTimeout(r, 0));
  });
});

// --- seam 3 (progressivo) ---------------------------------------------------

test("seam 3: cada POST resolvido substitui só o seu card", async () => {
  const items = [
    listItem({ filterId: "f1", name: "E1", stale: true, report: null }),
    listItem({ filterId: "f2", name: "E2", stale: true, report: null }),
  ];
  const p1 = deferred<Response>();
  const p2 = deferred<Response>();
  routeFetch({
    get: () => jsonResponse(items),
    post: (body) => (body.filterId === "f1" ? p1.promise : p2.promise),
  });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  await act(async () => {
    p1.resolve(jsonResponse(freshItem("f1", "resumo f1")));
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(byId(result.current.items, "f1").status).toBe("ready");
  expect(byId(result.current.items, "f1").reportText).toBe("resumo f1");
  // o outro não mudou
  expect(byId(result.current.items, "f2").status).toBe("generating");

  await act(async () => {
    p2.resolve(jsonResponse(freshItem("f2")));
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(byId(result.current.items, "f2").status).toBe("ready");
});

// --- seam 4 (erro) ----------------------------------------------------------

test("seam 4: POST rejeitado com relatório antigo mantém o texto e vira error", async () => {
  const items = [listItem({ filterId: "f1", stale: true, report: report("texto antigo") })];
  const p = deferred<Response>();
  routeFetch({ get: () => jsonResponse(items), post: () => p.promise });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();
  // enquanto pende, mantém o snapshot/texto antigos com status generating
  expect(byId(result.current.items, "f1").status).toBe("generating");
  expect(byId(result.current.items, "f1").reportText).toBe("texto antigo");

  await act(async () => {
    p.reject(new Error("boom"));
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(byId(result.current.items, "f1").status).toBe("error");
  expect(byId(result.current.items, "f1").reportText).toBe("texto antigo");
});

test("seam 4: POST rejeitado sem relatório vira error sem texto", async () => {
  const items = [listItem({ filterId: "f1", stale: true, report: null })];
  const p = deferred<Response>();
  routeFetch({ get: () => jsonResponse(items), post: () => p.promise });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  await act(async () => {
    p.reject(new Error("boom"));
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(byId(result.current.items, "f1").status).toBe("error");
  expect(byId(result.current.items, "f1").reportText).toBeNull();
});

test("seam 4b: resposta não-ok (500) também vira error", async () => {
  const items = [listItem({ filterId: "f1", stale: true, report: null })];
  routeFetch({
    get: () => jsonResponse(items),
    post: () => jsonResponse({ error: "falhou" }, false, 500),
  });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  expect(byId(result.current.items, "f1").status).toBe("error");
});

test("seam 4c: POST 200 com report null e stale true (vencedor da corrida falhou) vira error, não ready vazio", async () => {
  const items = [listItem({ filterId: "f1", stale: true, report: null })];
  routeFetch({
    get: () => jsonResponse(items),
    post: () => jsonResponse({ filterId: "f1", name: "Evento 1", report: null, stale: true }),
  });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  expect(byId(result.current.items, "f1").status).toBe("error");
  expect(byId(result.current.items, "f1").reportText).toBeNull();
});

test("seam 4d: POST 200 com stale true e relatório antigo (vencedor falhou, mas havia texto anterior) vira error preservando o texto", async () => {
  const items = [listItem({ filterId: "f1", stale: true, report: report("texto antigo") })];
  routeFetch({
    get: () => jsonResponse(items),
    post: () =>
      jsonResponse({
        filterId: "f1",
        name: "Evento 1",
        report: report("texto antigo"),
        stale: true,
      }),
  });

  const { result } = renderHook(() => useSixDados("acc-1"));
  await flush();

  expect(byId(result.current.items, "f1").status).toBe("error");
  expect(byId(result.current.items, "f1").reportText).toBe("texto antigo");
});

// --- seam 6 (unmount) -------------------------------------------------------

test("seam 6: unmount durante POST pendente não faz setState (sem warning)", async () => {
  const items = [listItem({ filterId: "f1", stale: true, report: null })];
  const p = deferred<Response>();
  routeFetch({ get: () => jsonResponse(items), post: () => p.promise });

  const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  const { unmount } = renderHook(() => useSixDados("acc-1"));
  await flush();

  unmount();

  await act(async () => {
    p.resolve(jsonResponse(freshItem("f1")));
    await new Promise((r) => setTimeout(r, 0));
  });

  expect(errSpy).not.toHaveBeenCalled();
  errSpy.mockRestore();
});

// --- accountId ausente ------------------------------------------------------

test("accountId null não dispara nenhum fetch", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;

  renderHook(() => useSixDados(null));

  expect(fetchMock).not.toHaveBeenCalled();
});
