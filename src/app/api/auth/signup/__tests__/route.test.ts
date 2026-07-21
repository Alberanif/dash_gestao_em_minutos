import { NextRequest } from "next/server";

const mockCreateUser = jest.fn();
const mockListUsers = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({
    auth: { admin: { createUser: mockCreateUser, listUsers: mockListUsers } },
  })),
}));

const VALID = {
  name: "Maria Solicitante",
  email: "maria@igtcoaching.com",
  password: "senha-forte-123",
  passwordConfirm: "senha-forte-123",
};

function signupRequest(body: object, ip = "203.0.113.1"): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

/** Cada teste recebe o módulo zerado — o rate limit vive em memória. */
async function freshRoute() {
  jest.resetModules();
  return (await import("../route")).POST;
}

/** Sem pendentes na fila, salvo indicação em contrário. */
function pendingQueueSize(size: number) {
  mockListUsers.mockResolvedValue({
    data: {
      users: Array.from({ length: size }, (_, i) => ({
        id: `p-${i}`,
        app_metadata: { role: "pendente" },
      })),
    },
    error: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  pendingQueueSize(0);
  mockCreateUser.mockResolvedValue({
    data: { user: { id: "novo-1", email: VALID.email } },
    error: null,
  });
});

describe("POST /api/auth/signup", () => {
  it("cria a conta como pendente, com o nome informado e sem exigir confirmação de e-mail", async () => {
    const POST = await freshRoute();

    const response = await POST(signupRequest(VALID));

    expect(response.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: VALID.email,
        password: VALID.password,
        email_confirm: true,
        app_metadata: { role: "pendente" },
        user_metadata: { name: VALID.name },
      })
    );
  });

  it("nunca devolve a senha na resposta", async () => {
    const POST = await freshRoute();

    const body = await (await POST(signupRequest(VALID))).json();

    expect(JSON.stringify(body)).not.toContain(VALID.password);
  });
});

describe("validação do cadastro", () => {
  const casosInvalidos: Array<[string, object]> = [
    ["nome vazio", { ...VALID, name: "   " }],
    ["nome ausente", { ...VALID, name: undefined }],
    ["e-mail sem formato válido", { ...VALID, email: "maria(arroba)igt" }],
    ["e-mail ausente", { ...VALID, email: undefined }],
    ["senha com menos de 8 caracteres", { ...VALID, password: "curta7", passwordConfirm: "curta7" }],
    ["confirmação divergente", { ...VALID, passwordConfirm: "outra-senha-123" }],
  ];

  it.each(casosInvalidos)("rejeita %s com 400 e não cria conta", async (_caso, body) => {
    const POST = await freshRoute();

    const response = await POST(signupRequest(body));

    expect(response.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("explica o motivo da recusa", async () => {
    const POST = await freshRoute();

    const body = await (
      await POST(signupRequest({ ...VALID, password: "curta7", passwordConfirm: "curta7" }))
    ).json();

    expect(body.error).toMatch(/8/);
  });
});

describe("proteção contra abuso", () => {
  it("recusa com 409 e mensagem única um e-mail que já existe, sem revelar se a conta é ativa ou pendente", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "A user with this email address has already been registered" },
    });
    const POST = await freshRoute();

    const response = await POST(signupRequest(VALID));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Este e-mail já possui conta ou solicitação em andamento");
  });

  it("recusa com 429 quando a fila de pendentes está cheia", async () => {
    pendingQueueSize(20);
    const POST = await freshRoute();

    const response = await POST(signupRequest(VALID));

    expect(response.status).toBe(429);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("limita a rajada de tentativas vindas do mesmo IP", async () => {
    const POST = await freshRoute();
    const doSignup = (n: number) =>
      POST(signupRequest({ ...VALID, email: `pessoa${n}@igtcoaching.com` }, "198.51.100.7"));

    for (let n = 0; n < 5; n++) {
      expect((await doSignup(n)).status).toBe(201);
    }

    expect((await doSignup(6)).status).toBe(429);
  });

  it("não pune um IP diferente pela rajada do vizinho", async () => {
    const POST = await freshRoute();

    for (let n = 0; n < 5; n++) {
      await POST(signupRequest({ ...VALID, email: `pessoa${n}@igt.com` }, "198.51.100.7"));
    }

    const outroIp = await POST(signupRequest(VALID, "203.0.113.99"));

    expect(outroIp.status).toBe(201);
  });
});
