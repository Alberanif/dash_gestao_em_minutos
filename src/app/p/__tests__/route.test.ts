import { NextRequest } from "next/server";

const maybeSingle = jest.fn();
const download = jest.fn();
const filtros: Array<[string, string, unknown]> = [];

function builder() {
  const b: Record<string, unknown> = {};
  b.select = () => b;
  b.eq = (c: string, v: unknown) => (filtros.push(["eq", c, v]), b);
  b.not = (c: string, op: string, v: unknown) => (filtros.push(["not:" + op, c, v]), b);
  b.limit = () => b;
  b.maybeSingle = maybeSingle;
  return b;
}
const from = jest.fn(() => builder());
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from,
    storage: { from: () => ({ download }) },
  }),
}));

import { GET } from "../[id]/route";

const UUID = "0b8f2a4e-1111-4222-8333-444455556666";
function chamar(id: string) {
  return GET(new NextRequest(`http://localhost/p/${id}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  filtros.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
});

describe("GET /p/[id]", () => {
  it("devolve 404 amigável para id inválido sem consultar o banco", async () => {
    const r = await chamar("a/b");
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("Página não encontrada.");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(from).not.toHaveBeenCalled();
  });

  it("404 quando não há link ativo", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await chamar("slug")).status).toBe(404);
  });

  it("404 quando o arquivo some do bucket", async () => {
    maybeSingle.mockResolvedValue({ data: { label: "L", arquivo_path: "x.html", arquivado_em: null }, error: null });
    download.mockResolvedValue({ data: null, error: { message: "nf" } });
    expect((await chamar("slug")).status).toBe(404);
  });

  it("serve HTML transformado com os cabeçalhos", async () => {
    maybeSingle.mockResolvedValue({
      data: { label: "Meu Link", arquivo_path: "abc.html", arquivado_em: "2026-10-16T15:00:00Z" },
      error: null,
    });
    download.mockResolvedValue({ data: new Blob(["<head><title>x</title></head><body>oi</body>"]), error: null });
    const r = await chamar("slug");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(r.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    const html = await r.text();
    expect(html).toContain("<title>Meu Link</title>");
    expect(html).toContain("Página arquivada em 16/10/2026");
    expect(download).toHaveBeenCalledWith("abc.html");
  });

  it("slug filtra por slug; uuid filtra por id; sempre exige ativo, não excluído e com arquivo", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await chamar("minha-pagina");
    expect(filtros).toContainEqual(["eq", "slug", "minha-pagina"]);
    expect(filtros).toContainEqual(["eq", "deleted", false]);
    expect(filtros).toContainEqual(["eq", "pagina_ativa", true]);
    expect(filtros).toContainEqual(["not:is", "arquivo_path", null]);
    filtros.length = 0;
    await chamar(UUID);
    expect(filtros).toContainEqual(["eq", "id", UUID]);
    expect(filtros.find((f) => f[1] === "slug")).toBeUndefined();
  });

  it("500 quando falta configuração", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await chamar("slug");
    expect(r.status).toBe(500);
    expect(await r.text()).toContain("Página não encontrada.");
  });
});
