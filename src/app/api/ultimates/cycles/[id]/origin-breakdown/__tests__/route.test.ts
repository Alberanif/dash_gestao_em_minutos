import { NextRequest, NextResponse } from "next/server";

const mockRequireRole = jest.fn();
jest.mock("@/lib/utils/api-auth", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({ from: mockFrom })),
}));

import { POST } from "../route";

// Ciclo "Pitch PC Ao Vivo - 2026" — o único com base de origem configurada em
// src/lib/ultimates/origin-source.ts. Usar o id real é proposital: se alguém
// mexer no mapa sem querer, este teste cai.
const CYCLE = "fa6160b9-984b-44a5-8171-8cddd5f18775";

// Terminal da consulta à base de inscritos. Recebe (from, to) de cada página.
const mockRange = jest.fn();
const mockSelect = jest.fn();

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ultimates/cycles/x/origin-breakdown", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = (id: string = CYCLE) => ({ params: Promise.resolve({ id }) });

// Base enxuta com as duas dimensões reais da tabela do evento.
const BASE = [
  { email: "p1@ex.com", modalidade: "Presencial", categoria: "ULTIMATE" },
  { email: "p2@ex.com", modalidade: "Presencial", categoria: "ULTIMATE" },
  { email: "o1@ex.com", modalidade: "Online", categoria: "START" },
  { email: "o2@ex.com", modalidade: "Online", categoria: "START" },
  { email: "o3@ex.com", modalidade: "Online", categoria: "BLACK" },
];

beforeEach(() => {
  jest.clearAllMocks();

  mockRequireRole.mockResolvedValue({ error: null, userId: "user-1", role: "gestor" });
  mockRange.mockResolvedValue({ data: BASE, error: null });
  mockSelect.mockReturnValue({ range: mockRange });
  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("POST /api/ultimates/cycles/[id]/origin-breakdown", () => {
  it("respeita o gate de papel antes de tocar no banco", async () => {
    mockRequireRole.mockResolvedValue({
      error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }),
    });

    const res = await POST(makeRequest({ emails: [] }), params());

    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(["gestor", "analista"]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("devolve 404 para ciclo sem base de origem configurada", async () => {
    const res = await POST(
      makeRequest({ emails: [] }),
      params("226e8082-3fc1-4fa0-b00b-e997d537df92")
    );

    expect(res.status).toBe(404);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("exige emails como array", async () => {
    expect((await POST(makeRequest({}), params())).status).toBe(400);
    expect((await POST(makeRequest({ emails: "p1@ex.com" }), params())).status).toBe(400);
    expect((await POST(makeRequest(undefined), params())).status).toBe(400);
  });

  it("recusa payload acima do teto", async () => {
    const emails = Array.from({ length: 20001 }, (_, i) => `x${i}@ex.com`);

    const res = await POST(makeRequest({ emails }), params());

    expect(res.status).toBe(413);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("cruza as compras e devolve um bloco por dimensão", async () => {
    const res = await POST(
      makeRequest({ emails: ["p1@ex.com", "o1@ex.com", "fantasma@ex.com"] }),
      params()
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.blocks.map((b: { key: string }) => b.key)).toEqual([
      "modalidade",
      "categoria",
    ]);

    // Presencial 1/2 = 50%, Online 1/3 = 33,3% — ordenado por conversão.
    expect(body.blocks[0]).toEqual({
      key: "modalidade",
      title: "Por modalidade",
      rows: [
        { origin: "Presencial", purchases: 1, base: 2, conversion: 50 },
        { origin: "Online", purchases: 1, base: 3, conversion: (1 / 3) * 100 },
        { origin: null, purchases: 1, base: null, conversion: null },
      ],
    });

    // Mesma compra, outra lente: START converte 1/2, ULTIMATE 1/2, BLACK 0/1.
    expect(body.blocks[1].rows).toEqual([
      { origin: "START", purchases: 1, base: 2, conversion: 50 },
      { origin: "ULTIMATE", purchases: 1, base: 2, conversion: 50 },
      { origin: "BLACK", purchases: 0, base: 1, conversion: 0 },
      { origin: null, purchases: 1, base: null, conversion: null },
    ]);
  });

  it("lê a tabela do evento pedindo só as colunas configuradas", async () => {
    await POST(makeRequest({ emails: [] }), params());

    expect(mockFrom).toHaveBeenCalledWith("pc_ao_vivo_26_compras");
    expect(mockSelect).toHaveBeenCalledWith("email, modalidade, categoria");
  });

  it("nunca devolve email da base de inscritos", async () => {
    const res = await POST(makeRequest({ emails: ["p1@ex.com"] }), params());
    const raw = JSON.stringify(await res.json());

    // A base tem nome e email de gente real; só agregado atravessa.
    for (const row of BASE) {
      expect(raw).not.toContain(row.email);
    }
  });

  it("pagina a base para não truncar em 1000 linhas", async () => {
    const pagina1 = Array.from({ length: 1000 }, (_, i) => ({
      email: `a${i}@ex.com`,
      modalidade: "Online",
      categoria: "START",
    }));
    const pagina2 = [{ email: "b0@ex.com", modalidade: "Presencial", categoria: "VIP" }];
    mockRange.mockResolvedValueOnce({ data: pagina1, error: null });
    mockRange.mockResolvedValueOnce({ data: pagina2, error: null });

    const res = await POST(makeRequest({ emails: ["b0@ex.com"] }), params());
    const body = await res.json();

    expect(mockRange).toHaveBeenNthCalledWith(1, 0, 999);
    expect(mockRange).toHaveBeenNthCalledWith(2, 1000, 1999);
    // A 1001ª linha existe na base — sem paginar, "Presencial" nem apareceria e
    // a compra viraria "não encontrado".
    expect(body.blocks[0].rows).toContainEqual({
      origin: "Presencial",
      purchases: 1,
      base: 1,
      conversion: 100,
    });
    expect(body.blocks[0].rows.find((r: { origin: string }) => r.origin === "Online")).toMatchObject(
      { base: 1000 }
    );
  });

  it("propaga falha da base como 500", async () => {
    mockRange.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });

    const res = await POST(makeRequest({ emails: [] }), params());

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("relation does not exist");
  });

  it("descarta entradas que não são string na lista de emails", async () => {
    const res = await POST(
      makeRequest({ emails: ["p1@ex.com", null, 42, { email: "o1@ex.com" }] }),
      params()
    );
    const body = await res.json();

    // Só p1 contou; o lixo não virou "não encontrado".
    expect(body.blocks[0].rows).toEqual([
      { origin: "Presencial", purchases: 1, base: 2, conversion: 50 },
      { origin: "Online", purchases: 0, base: 3, conversion: 0 },
    ]);
  });
});
