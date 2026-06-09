import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Mock validateApiAuth
jest.mock("@/lib/utils/api-auth", () => ({
  validateApiAuth: jest.fn(),
}));

// Mock streamAgentResponse
jest.mock("@/lib/agent/graph", () => ({
  streamAgentResponse: jest.fn(),
}));

import { validateApiAuth } from "@/lib/utils/api-auth";
import { streamAgentResponse } from "@/lib/agent/graph";

const mockValidateApiAuth = validateApiAuth as jest.MockedFunction<typeof validateApiAuth>;
const mockStreamAgentResponse = streamAgentResponse as jest.MockedFunction<typeof streamAgentResponse>;

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/agent/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function makeReadableStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/agent/chat", () => {
  it("retorna 401 quando não há autenticação", async () => {
    // Arrange
    mockValidateApiAuth.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null,
      role: "gestor",
    });

    const { POST } = await import("../chat/route");
    const req = makeRequest({ message: "Olá" });

    // Act
    const res = await POST(req);

    // Assert
    expect(res.status).toBe(401);
  });

  it("retorna 400 quando body não tem message", async () => {
    // Arrange
    mockValidateApiAuth.mockResolvedValue({
      error: null,
      userId: "user-1",
      role: "gestor",
    });

    const { POST } = await import("../chat/route");
    const req = makeRequest({ history: [], context: null });

    // Act
    const res = await POST(req);
    const body = await res.json();

    // Assert
    expect(res.status).toBe(400);
    expect(body.error).toBe("message is required");
  });

  it("retorna 200 com Content-Type text/event-stream em request válida", async () => {
    // Arrange
    mockValidateApiAuth.mockResolvedValue({
      error: null,
      userId: "user-1",
      role: "gestor",
    });
    mockStreamAgentResponse.mockResolvedValue(makeReadableStream("resposta do agente"));

    const { POST } = await import("../chat/route");
    const req = makeRequest({
      message: "Qual é o CPL?",
      history: [],
      context: { startDate: "2026-05-01", endDate: "2026-05-31" },
    });

    // Act
    const res = await POST(req);

    // Assert
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("repassa o cookie da request nos authHeaders das tool calls", async () => {
    // Arrange
    mockValidateApiAuth.mockResolvedValue({
      error: null,
      userId: "user-1",
      role: "gestor",
    });
    mockStreamAgentResponse.mockResolvedValue(makeReadableStream("ok"));

    const { POST } = await import("../chat/route");
    const cookieValue = "session=abc123; other=xyz";
    const req = makeRequest(
      {
        message: "teste",
        history: [],
        context: null,
      },
      { cookie: cookieValue }
    );

    // Act
    await POST(req);

    // Assert: streamAgentResponse was called with authHeaders containing the cookie
    expect(mockStreamAgentResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        authHeaders: { cookie: cookieValue },
      })
    );
  });
});
