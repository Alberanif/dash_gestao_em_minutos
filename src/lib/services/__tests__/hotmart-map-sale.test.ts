import { mapHotmartSaleItem, type HotmartSaleItem } from "../hotmart";

// O módulo importa o client de serviço no topo; nada aqui exercita I/O, mas o
// mock evita depender de env de Supabase para carregar o arquivo.
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(),
}));

const COLLECTED_AT = "2026-07-31T12:00:00.000Z";

function makeItem(buyer: HotmartSaleItem["buyer"]): HotmartSaleItem {
  return {
    product: { id: 555, name: "Curso Ultimate" },
    buyer,
    purchase: {
      transaction: "HP-1",
      order_date: 1_700_000_000_000,
      approved_date: 1_700_000_100_000,
      status: "APPROVED",
      price: { value: 497.9, currency_code: "BRL" },
    },
  };
}

describe("mapHotmartSaleItem — identidade do comprador (PRD #146)", () => {
  it("persiste o nome que a Hotmart envia", () => {
    const row = mapHotmartSaleItem(
      makeItem({ email: "novo@example.com", name: "Maria Souza" }),
      "acc-1",
      COLLECTED_AT
    );

    expect(row.buyer_name).toBe("Maria Souza");
  });

  it("apara espaços do nome", () => {
    const row = mapHotmartSaleItem(
      makeItem({ email: "novo@example.com", name: "  Maria Souza  " }),
      "acc-1",
      COLLECTED_AT
    );

    expect(row.buyer_name).toBe("Maria Souza");
  });

  it("nome ausente vira null", () => {
    const row = mapHotmartSaleItem(
      makeItem({ email: "novo@example.com" }),
      "acc-1",
      COLLECTED_AT
    );

    expect(row.buyer_name).toBeNull();
  });

  it("nome só com espaços vira null", () => {
    const row = mapHotmartSaleItem(
      makeItem({ email: "novo@example.com", name: "   " }),
      "acc-1",
      COLLECTED_AT
    );

    expect(row.buyer_name).toBeNull();
  });

  // ── TESTE-GUARDA (regra 4.4 do PRD #146) ────────────────────────────────────
  // Esta função alimenta os DOIS crons e o "Atualizar agora". A API
  // sales/history NÃO devolve telefone — só o webhook traz checkout_phone. O
  // upsert do PostgREST só atualiza colunas PRESENTES no payload, então a
  // ausência desta chave é o que preserva o telefone gravado pelo webhook.
  // Incluí-la aqui (mesmo como null, mesmo "por consistência") faria o cron
  // semanal de 60 dias apagar todos os telefones, em silêncio, uma vez por
  // semana. Este teste existe para que essa regressão falhe em CI, e não em
  // produção três semanas depois.
  it("NÃO emite a chave buyer_phone — senão o cron apaga o telefone do webhook", () => {
    const row = mapHotmartSaleItem(
      makeItem({ email: "novo@example.com", name: "Maria Souza" }),
      "acc-1",
      COLLECTED_AT
    );

    expect(Object.keys(row)).not.toContain("buyer_phone");
  });
});
