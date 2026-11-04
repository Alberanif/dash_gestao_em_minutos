/**
 * Endpoints de Configurações são só do gestor: o analista vê tudo, menos Configurações e gestão de
 * usuários. O proxy não checa papel nessas rotas, então a guarda precisa estar no próprio handler.
 */
import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
const mockValidateApiAuth = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
  validateCronApiKey: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}));

type Handler = (req: NextRequest, ctx?: { params: Promise<{ id: string }> }) => Promise<Response>;

const SOMENTE_GESTOR: Array<[string, string, string]> = [
  ["POST", "accounts", "../accounts/route"],
  ["PATCH", "accounts/[id]", "../accounts/[id]/route"],
  ["DELETE", "accounts/[id]", "../accounts/[id]/route"],
  ["POST", "sync", "../sync/route"],
  ["GET", "logs", "../logs/route"],
  ["GET", "auth/youtube/connect", "../auth/youtube/connect/route"],
  ["POST", "hotmart/batch-collect", "../hotmart/batch-collect/route"],
  ["POST", "instagram/batch-collect", "../instagram/batch-collect/route"],
  ["POST", "meta-ads/batch-collect", "../meta-ads/batch-collect/route"],
  ["POST", "youtube/batch-collect", "../youtube/batch-collect/route"],
  ["POST", "hotmart/sync-products", "../hotmart/sync-products/route"],
  ["POST", "meta-ads/campaigns-sync", "../meta-ads/campaigns-sync/route"],
];

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({
    error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    userId: null,
    role: "analista",
  });
});

describe("endpoints de configuração exigem gestor", () => {
  it.each(SOMENTE_GESTOR)("%s /api/%s devolve 403 ao analista", async (metodo, rota, modulo) => {
    const mod = (await import(modulo)) as Record<string, Handler>;
    const req = new NextRequest(`http://localhost/api/${rota}`, { method: metodo });

    const res = await mod[metodo](req, { params: Promise.resolve({ id: "x" }) });

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor"]);
  });
});

describe("GET /api/accounts segue aberto ao analista (os dashboards leem as contas)", () => {
  it("não exige gestor", async () => {
    mockValidateApiAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      userId: null,
      role: "pendente",
    });
    const { GET } = (await import("../accounts/route")) as { GET: Handler };

    await GET(new NextRequest("http://localhost/api/accounts"));

    expect(mockValidateApiAuth).toHaveBeenCalled();
    expect(mockRequireRole).not.toHaveBeenCalled();
  });
});
