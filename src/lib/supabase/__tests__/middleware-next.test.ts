import { NextRequest } from "next/server";

const getUser = jest.fn();
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({ auth: { getUser } })),
}));

import { updateSession } from "../middleware";

function run(url: string) {
  return updateSession(new NextRequest(url));
}

describe("updateSession - redirect de não logado carrega ?next=", () => {
  beforeEach(() => {
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("monta /login?next=<pathname+search> codificado", async () => {
    const res = await run("http://localhost/indicadores/x?view=planilha");
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.search).toBe("?next=%2Findicadores%2Fx%3Fview%3Dplanilha");
  });

  it("funciona em rota fora de Indicadores", async () => {
    const res = await run("http://localhost/ultimates");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("next")).toBe("/ultimates");
  });

  it("não herda query da request original além do next", async () => {
    const res = await run("http://localhost/ultimates?a=1&b=2");
    const loc = new URL(res.headers.get("location")!);
    expect([...loc.searchParams.keys()]).toEqual(["next"]);
    expect(loc.searchParams.get("next")).toBe("/ultimates?a=1&b=2");
  });

  it.each([
    "/login",
    "/cadastro",
    "/api/auth/signup",
    "/api/cron/x",
    "/api/auth/youtube/callback",
  ])("%s não redireciona nem gera next", async (p) => {
    const res = await run(`http://localhost${p}`);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("updateSession - roles inalteradas (next ignorado)", () => {
  function asRole(role: string) {
    getUser.mockResolvedValue({
      data: { user: { app_metadata: { role } } },
    });
  }

  it("comum em /indicadores vai a /base-de-dados sem next", async () => {
    asRole("comum");
    const res = await run("http://localhost/indicadores/x");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/base-de-dados");
    expect(loc.searchParams.has("next")).toBe(false);
  });

  it("pendente vai a /aguardando-aprovacao sem next", async () => {
    asRole("pendente");
    const res = await run("http://localhost/indicadores/x");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/aguardando-aprovacao");
    expect(loc.searchParams.has("next")).toBe(false);
  });
});
