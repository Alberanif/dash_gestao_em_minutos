import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";

jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: jest.fn(),
}));

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

function makeRequest(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : {},
  });
}

function requireRoleMock() {
  return jest.requireMock("@/lib/utils/api-auth").requireRole as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();
  requireRoleMock().mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
});

describe("GET /api/vendas/folders", () => {
  it("devolve 401 se requireRole falhar", async () => {
    requireRoleMock().mockResolvedValueOnce({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "pendente",
    });

    const req = makeRequest("GET", "http://localhost:3000/api/vendas/folders");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("retorna lista de pastas", async () => {
    const mockFolders = [
      { id: "f1", name: "Lançamento A", account_id: "acc-1" },
      { id: "f2", name: "Perpétuo B", account_id: "acc-1" },
    ];

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: mockFolders, error: null }),
      }),
    });

    const req = makeRequest("GET", "http://localhost:3000/api/vendas/folders");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folders).toHaveLength(2);
    expect(body.folders[0].name).toBe("Lançamento A");
  });
});

describe("POST /api/vendas/folders", () => {
  it("rejeita nome vazio com 400", async () => {
    const req = makeRequest("POST", "http://localhost:3000/api/vendas/folders", { name: "   " });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Nome da pasta é obrigatório");
  });

  it("cria pasta com sucesso", async () => {
    const newFolder = { id: "f3", name: "Nova Pasta", account_id: "acc-1" };

    mockFrom.mockImplementation((table: string) => {
      if (table === "dash_gestao_accounts") {
        return {
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: { id: "acc-1" } }),
            }),
          }),
        };
      }
      if (table === "dash_gestao_vendas_folders") {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: newFolder, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const req = makeRequest("POST", "http://localhost:3000/api/vendas/folders", { name: "Nova Pasta" });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.folder.name).toBe("Nova Pasta");
  });
});

describe("PATCH /api/vendas/folders/[id]", () => {
  it("rejeita nome vazio com 400", async () => {
    const req = makeRequest("PATCH", "http://localhost:3000/api/vendas/folders/f1", { name: "" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Nome da pasta é obrigatório");
  });

  it("devolve 404 se a pasta não existir", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const req = makeRequest("PATCH", "http://localhost:3000/api/vendas/folders/f99", { name: "Novo Nome" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f99" }) });

    expect(res.status).toBe(404);
  });

  it("renomeia a pasta com sucesso", async () => {
    const updatedFolder = { id: "f1", name: "Novo Nome", account_id: "acc-1" };

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: "f1" } }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: updatedFolder, error: null }),
          }),
        }),
      }),
    });

    const req = makeRequest("PATCH", "http://localhost:3000/api/vendas/folders/f1", { name: "Novo Nome" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.folder.name).toBe("Novo Nome");
  });
});

describe("DELETE /api/vendas/folders/[id]", () => {
  it("devolve 404 se a pasta não existir", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    const req = makeRequest("DELETE", "http://localhost:3000/api/vendas/folders/f99");
    const res = await DELETE(req, { params: Promise.resolve({ id: "f99" }) });

    expect(res.status).toBe(404);
  });

  it("deleta a pasta com sucesso", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: "f1" } }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const req = makeRequest("DELETE", "http://localhost:3000/api/vendas/folders/f1");
    const res = await DELETE(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
