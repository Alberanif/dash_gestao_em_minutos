const mockGetUser = jest.fn();
const mockGetUserById = jest.fn();
const mockUpdateUserById = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(async () => ({ auth: { getUser: mockGetUser } })),
  createSupabaseServiceClient: jest.fn(() => ({
    auth: { admin: { getUserById: mockGetUserById, updateUserById: mockUpdateUserById } },
  })),
}));

import { NextRequest } from "next/server";
import { PATCH } from "../route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/central-de-links/acesso", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function logarComo(id: string, centralRole: unknown) {
  mockGetUser.mockResolvedValue({ data: { user: { id } } });
  mockGetUserById.mockImplementation(async (alvo: string) => {
    if (alvo === id) return { data: { user: { id, app_metadata: { central_role: centralRole } } }, error: null };
    if (alvo === "alvo-1")
      return {
        data: { user: { id: "alvo-1", app_metadata: { role: "analista", central_role: "membro", outra: 1 } } },
        error: null,
      };
    return { data: { user: null }, error: { message: "not found" } };
  });
  mockUpdateUserById.mockResolvedValue({ data: { user: { id: "alvo-1" } }, error: null });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PATCH /api/central-de-links/acesso", () => {
  it("sem sessão responde 401 e não grava", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(req({ userId: "alvo-1", centralRole: "membro" }));
    expect(res.status).toBe(401);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("membro da Central recebe 403 e não grava", async () => {
    logarComo("eu", "membro");
    const res = await PATCH(req({ userId: "alvo-1", centralRole: "admin" }));
    expect(res.status).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("quem não tem papel na Central recebe 403", async () => {
    logarComo("eu", undefined);
    const res = await PATCH(req({ userId: "alvo-1", centralRole: "admin" }));
    expect(res.status).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("admin não altera o próprio acesso (403)", async () => {
    logarComo("eu", "admin");
    const res = await PATCH(req({ userId: "eu", centralRole: null }));
    expect(res.status).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("valor inválido responde 400", async () => {
    logarComo("eu", "admin");
    for (const centralRole of ["dono", 1, undefined]) {
      const res = await PATCH(req({ userId: "alvo-1", centralRole }));
      expect(res.status).toBe(400);
    }
    expect((await PATCH(req({ centralRole: "membro" }))).status).toBe(400);
    expect((await PATCH(req("não é json"))).status).toBe(400);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("alvo inexistente responde 404", async () => {
    logarComo("eu", "admin");
    const res = await PATCH(req({ userId: "fantasma", centralRole: "membro" }));
    expect(res.status).toBe(404);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("grava o novo papel preservando as outras chaves de app_metadata", async () => {
    logarComo("eu", "admin");
    const res = await PATCH(req({ userId: "alvo-1", centralRole: "admin" }));
    expect(res.status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith("alvo-1", {
      app_metadata: { role: "analista", central_role: "admin", outra: 1 },
    });
    expect(await res.json()).toMatchObject({ id: "alvo-1", central_role: "admin" });
  });

  it("null remove só central_role e mantém o resto", async () => {
    logarComo("eu", "admin");
    const res = await PATCH(req({ userId: "alvo-1", centralRole: null }));
    expect(res.status).toBe(200);
    const [, payload] = mockUpdateUserById.mock.calls[0];
    expect(payload.app_metadata).toEqual({ role: "analista", outra: 1 });
    expect("central_role" in payload.app_metadata).toBe(false);
  });

  it("erro do Supabase ao gravar responde 500", async () => {
    logarComo("eu", "admin");
    mockUpdateUserById.mockResolvedValue({ data: { user: null }, error: { message: "boom" } });
    const res = await PATCH(req({ userId: "alvo-1", centralRole: "membro" }));
    expect(res.status).toBe(500);
  });
});
