import { NextRequest } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  validateApiAuth: jest.fn(),
}));

const mockCreateUser = jest.fn();
const mockUpdateUserById = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({
    auth: { admin: { createUser: mockCreateUser, updateUserById: mockUpdateUserById } },
  })),
}));

function json(url: string, method: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, { method, body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({ error: null, userId: "gestor-1", role: "gestor" });
  mockCreateUser.mockResolvedValue({
    data: { user: { id: "n-1", email: "n@igt.com", app_metadata: { role: "analista" } } },
    error: null,
  });
  mockUpdateUserById.mockResolvedValue({
    data: { user: { id: "u-1", email: "u@igt.com", app_metadata: { role: "analista" } } },
    error: null,
  });
});

describe("papéis atribuíveis: só gestor e analista", () => {
  it("POST sem role cria a conta como analista", async () => {
    const { POST } = await import("../route");
    const res = await POST(json("/api/admin/users", "POST", { email: "n@igt.com", password: "12345678" }));

    expect(res.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ app_metadata: { role: "analista" } })
    );
  });

  it.each(["comum", "pendente", "admin"])("POST recusa a role %s", async (role) => {
    const { POST } = await import("../route");
    const res = await POST(json("/api/admin/users", "POST", { email: "n@igt.com", password: "12345678", role }));

    expect(res.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it.each(["comum", "pendente", "admin"])("PATCH recusa a role %s", async (role) => {
    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(json("/api/admin/users/u-1", "PATCH", { role }), {
      params: Promise.resolve({ id: "u-1" }),
    });

    expect(res.status).toBe(400);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it.each(["gestor", "analista"])("PATCH aceita a role %s", async (role) => {
    const { PATCH } = await import("../[id]/route");
    const res = await PATCH(json("/api/admin/users/u-1", "PATCH", { role }), {
      params: Promise.resolve({ id: "u-1" }),
    });

    expect(res.status).toBe(200);
  });
});
