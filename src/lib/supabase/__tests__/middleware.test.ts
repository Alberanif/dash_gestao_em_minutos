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

  it("trata role desconhecida como pendente — não pode escapar do bloqueio", async () => {
    signedInAs({ role: "admin" });

    const response = await visit("/dashboard/posicionamento");

    expect(response.headers.get("location")).toContain("/aguardando-aprovacao");
  });

  it("role desconhecida também não alcança as APIs de negócio", async () => {
    signedInAs({ role: "superuser" });

    expect((await visit("/api/admin/users")).status).toBe(403);
    expect((await visit("/api/base-de-dados/planilha")).status).toBe(403);
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

describe("rota pública da Central de Links (/p/*)", () => {
  it("ehRotaPublicaDaCentral só cobre /p/<algo>", async () => {
    const { ehRotaPublicaDaCentral } = await import("../middleware");
    expect(ehRotaPublicaDaCentral("/p/abc")).toBe(true);
    for (const p of ["/pasta", "/p", "/painel", "/pagina", "/pasta/x", "/api/p/x"]) {
      expect(ehRotaPublicaDaCentral(p)).toBe(false);
    }
  });

  it("/p/abc sem sessão passa, sem redirecionar", async () => {
    anonymous();
    const response = await visit("/p/abc");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("/p/abc passa também para conta pendente e comum", async () => {
    for (const role of ["pendente", "comum"]) {
      signedInAs({ role });
      const response = await visit("/p/abc");
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("/api/track e /t.js (coleta do Teste A/B) são públicos, e só eles", async () => {
    const { ehRotaPublicaDaCentral } = await import("../middleware");
    expect(ehRotaPublicaDaCentral("/api/track")).toBe(true);
    expect(ehRotaPublicaDaCentral("/t.js")).toBe(true);
    for (const p of ["/api/trackx", "/api/tracking", "/api/track/x", "/t.jsx", "/tt.js", "/t.json", "/x/t.js", "/api/track.js"]) {
      expect(ehRotaPublicaDaCentral(p)).toBe(false);
    }
  });

  it("/api/track e /t.js passam sem sessão, sem redirecionar", async () => {
    anonymous();
    for (const path of ["/api/track", "/t.js"]) {
      const response = await visit(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("/api/track e /t.js passam também para conta pendente e comum", async () => {
    for (const role of ["pendente", "comum"]) {
      signedInAs({ role });
      for (const path of ["/api/track", "/t.js"]) {
        const response = await visit(path);
        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
      }
    }
  });

  it("/api/trackx, /t.jsx e /tt.js continuam barrados sem sessão", async () => {
    anonymous();
    for (const path of ["/api/trackx", "/api/track/x", "/t.jsx", "/tt.js"]) {
      const response = await visit(path);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    }
  });

  it("/api/trackx continua dando 403 para conta pendente", async () => {
    signedInAs({ role: "pendente" });
    expect((await visit("/api/trackx")).status).toBe(403);
  });

  it("rotas de nome parecido continuam barradas sem sessão", async () => {
    anonymous();
    for (const path of ["/pagina", "/pasta", "/p", "/painel"]) {
      const response = await visit(path);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    }
  });
});
