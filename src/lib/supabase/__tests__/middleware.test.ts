import { NextRequest } from "next/server";

const mockGetUser = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

/** Sessão autenticada cujo `app_metadata` é o estado bruto da conta. */
function signedInAs(app_metadata: Record<string, unknown>) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1", app_metadata } },
  });
}

function anonymous() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function requestFor(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

async function visit(pathname: string) {
  const { updateSession } = await import("../middleware");
  return updateSession(requestFor(pathname));
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

describe("conta pendente", () => {
  it("é levada de qualquer página para /aguardando-aprovacao", async () => {
    signedInAs({ role: "pendente" });

    const response = await visit("/dashboard/posicionamento");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/aguardando-aprovacao");
  });

  it("permanece em /aguardando-aprovacao sem entrar em loop de redirect", async () => {
    signedInAs({ role: "pendente" });

    const response = await visit("/aguardando-aprovacao");

    expect(response.status).toBe(200);
  });

  it("recebe 403 ao chamar qualquer API de negócio", async () => {
    signedInAs({ role: "pendente" });

    for (const path of ["/api/admin/users", "/api/base-de-dados/planilha"]) {
      const response = await visit(path);
      expect(response.status).toBe(403);
    }
  });

  it("consegue sair — /api/auth/signout continua liberado", async () => {
    signedInAs({ role: "pendente" });

    const response = await visit("/api/auth/signout");

    expect(response.status).toBe(200);
  });

  it("trata conta sem role como pendente, e não como gestor", async () => {
    signedInAs({});

    const response = await visit("/dashboard/posicionamento");

    expect(response.headers.get("location")).toContain("/aguardando-aprovacao");
  });
});

describe("visitante não autenticado", () => {
  it("acessa /cadastro e a API de signup sem ser mandado para o login", async () => {
    anonymous();

    for (const path of ["/cadastro", "/api/auth/signup"]) {
      const response = await visit(path);
      expect(response.status).toBe(200);
    }
  });

  it("continua sendo mandado para o login em qualquer outra rota", async () => {
    anonymous();

    const response = await visit("/dashboard/posicionamento");

    expect(response.headers.get("location")).toContain("/login");
  });
});

describe("conta ativa", () => {
  it("não fica presa na página de espera — vai para a home", async () => {
    signedInAs({ role: "analista" });

    const response = await visit("/aguardando-aprovacao");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("mantém as restrições de 'comum': dashboard vai para base-de-dados", async () => {
    signedInAs({ role: "comum" });

    const response = await visit("/dashboard/posicionamento");

    expect(response.headers.get("location")).toContain("/base-de-dados");
  });

  it("mantém as restrições de 'comum': APIs fora de base-de-dados dão 403", async () => {
    signedInAs({ role: "comum" });

    expect((await visit("/api/admin/users")).status).toBe(403);
    expect((await visit("/api/base-de-dados/planilha")).status).toBe(200);
  });

  it("deixa o gestor navegar livremente", async () => {
    signedInAs({ role: "gestor" });

    expect((await visit("/dashboard/posicionamento")).status).toBe(200);
    expect((await visit("/api/admin/users")).status).toBe(200);
  });
});
