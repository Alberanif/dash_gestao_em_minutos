import { NextResponse } from "next/server";

const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

function signedInAs(app_metadata: Record<string, unknown>) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: "user-1", app_metadata } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateApiAuth", () => {
  it("trata usuário sem app_metadata.role como pendente, não como gestor", async () => {
    signedInAs({});

    const { validateApiAuth } = await import("../api-auth");
    const result = await validateApiAuth();

    expect(result.role).toBe("pendente");
  });

  it("bloqueia com 403 a conta pendente, sem liberar nenhuma API de negócio", async () => {
    signedInAs({ role: "pendente" });

    const { validateApiAuth } = await import("../api-auth");
    const result = await validateApiAuth();

    expect(result.error?.status).toBe(403);
  });

  it("trata role desconhecida como pendente e bloqueia com 403", async () => {
    signedInAs({ role: "admin" });

    const { validateApiAuth } = await import("../api-auth");
    const result = await validateApiAuth();

    expect(result.role).toBe("pendente");
    expect(result.error?.status).toBe(403);
  });

  it("mantém intacto o acesso de uma conta com role válida", async () => {
    signedInAs({ role: "analista" });

    const { validateApiAuth } = await import("../api-auth");
    const result = await validateApiAuth();

    expect(result.error).toBeNull();
    expect(result.role).toBe("analista");
  });
});

describe("requireRole", () => {
  it("nega a conta pendente mesmo quando a role exigida é a mais permissiva", async () => {
    signedInAs({ role: "pendente" });

    const { requireRole } = await import("../api-auth");
    const result = await requireRole(["gestor", "analista", "comum"]);

    expect(result.error?.status).toBe(403);
  });
});
