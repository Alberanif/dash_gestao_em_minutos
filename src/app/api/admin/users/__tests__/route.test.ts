const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  validateApiAuth: jest.fn(),
}));

const mockListUsers = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({
    auth: { admin: { listUsers: mockListUsers } },
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireRole.mockResolvedValue({ error: null, userId: "gestor-1", role: "gestor" });
});

describe("GET /api/admin/users", () => {
  it("expõe o nome do solicitante e o estado real da conta, sem mascarar pendente", async () => {
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "u-1",
            email: "solicitante@igtcoaching.com",
            app_metadata: { role: "pendente" },
            user_metadata: { name: "Maria Solicitante" },
            created_at: "2026-07-20T10:00:00Z",
            last_sign_in_at: null,
          },
        ],
      },
      error: null,
    });

    const { GET } = await import("../route");
    const body = await (await GET()).json();

    expect(body[0]).toMatchObject({
      email: "solicitante@igtcoaching.com",
      name: "Maria Solicitante",
      role: "pendente",
    });
  });

  it("nunca promove a gestor uma conta sem role", async () => {
    mockListUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: "u-2",
            email: "legado@igtcoaching.com",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-01-01T10:00:00Z",
            last_sign_in_at: null,
          },
        ],
      },
      error: null,
    });

    const { GET } = await import("../route");
    const body = await (await GET()).json();

    expect(body[0].role).toBe("pendente");
  });
});
