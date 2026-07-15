import {
  groupFiltersByStatus,
  eventoMetaLine,
  eventoCompositionSubtitle,
  statusSummaryCounts,
  matchesEventoSearch,
} from "../eventos";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";

function makeFilter(overrides: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Evento",
    hotmart_products: [],
    meta_ads_terms: ["termo"],
    captacao_leads_eventos: [],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupFiltersByStatus", () => {
  it("agrupa filtros nas 3 pastas por status", () => {
    const filters = [
      makeFilter({ id: "a", status: "ativo" }),
      makeFilter({ id: "b", status: "finalizado" }),
      makeFilter({ id: "c", status: "cancelado" }),
      makeFilter({ id: "d", status: "ativo" }),
    ];

    const groups = groupFiltersByStatus(filters);

    expect(groups.ativo.map((f) => f.id)).toEqual(["a", "d"]);
    expect(groups.finalizado.map((f) => f.id)).toEqual(["b"]);
    expect(groups.cancelado.map((f) => f.id)).toEqual(["c"]);
  });

  it("lista vazia produz 3 pastas vazias", () => {
    const groups = groupFiltersByStatus([]);
    expect(groups.ativo).toEqual([]);
    expect(groups.finalizado).toEqual([]);
    expect(groups.cancelado).toEqual([]);
  });

  it("status desconhecido cai na pasta de ativos", () => {
    const groups = groupFiltersByStatus([
      makeFilter({ id: "x", status: "arquivado" as FilterStatus }),
    ]);
    expect(groups.ativo.map((f) => f.id)).toEqual(["x"]);
  });
});

describe("eventoMetaLine", () => {
  it("ativo usa a data de criação com sufixo em andamento", () => {
    const line = eventoMetaLine(
      makeFilter({ status: "ativo", created_at: "2026-07-01T12:00:00Z" })
    );
    expect(line).toBe("Criado em 01/07/2026 · em andamento");
  });

  it("finalizado usa a data da mudança de status", () => {
    const line = eventoMetaLine(
      makeFilter({ status: "finalizado", status_changed_at: "2025-11-30T18:30:00Z" })
    );
    expect(line).toBe("Encerrado em 30/11/2025");
  });

  it("cancelado usa a data da mudança de status", () => {
    const line = eventoMetaLine(
      makeFilter({ status: "cancelado", status_changed_at: "2026-02-12T00:00:00Z" })
    );
    expect(line).toBe("Cancelado em 12/02/2026");
  });

  it("finalizado sem status_changed_at cai na data de criação", () => {
    const line = eventoMetaLine(
      makeFilter({ status: "finalizado", status_changed_at: null, created_at: "2026-01-05T00:00:00Z" })
    );
    expect(line).toBe("Encerrado em 05/01/2026");
  });
});

describe("eventoCompositionSubtitle", () => {
  it("mostra as 3 partes com pluralização", () => {
    const subtitle = eventoCompositionSubtitle(
      makeFilter({
        hotmart_products: [
          { product_id: "1", product_name: "A" },
          { product_id: "2", product_name: "B" },
        ],
        meta_ads_terms: ["x"],
        captacao_leads_eventos: ["e1", "e2", "e3"],
      })
    );
    expect(subtitle).toBe("2 produtos · 1 campanha · 3 eventos de captação");
  });

  it("omite partes zeradas", () => {
    const subtitle = eventoCompositionSubtitle(
      makeFilter({ hotmart_products: [], meta_ads_terms: [], captacao_leads_eventos: ["e1"] })
    );
    expect(subtitle).toBe("1 evento de captação");
  });

  it("singular para 1 produto", () => {
    const subtitle = eventoCompositionSubtitle(
      makeFilter({
        hotmart_products: [{ product_id: "1", product_name: "A" }],
        meta_ads_terms: [],
        captacao_leads_eventos: [],
      })
    );
    expect(subtitle).toBe("1 produto");
  });

  it("termos em branco não contam como campanha", () => {
    const subtitle = eventoCompositionSubtitle(
      makeFilter({ hotmart_products: [], meta_ads_terms: ["  ", ""], captacao_leads_eventos: ["e1"] })
    );
    expect(subtitle).toBe("1 evento de captação");
  });
});

describe("matchesEventoSearch", () => {
  const filter = makeFilter({ name: "PC Ao Vivo 2026" });

  it("match parcial e case-insensitive no nome", () => {
    expect(matchesEventoSearch(filter, "ao vivo")).toBe(true);
    expect(matchesEventoSearch(filter, "pc AO")).toBe(true);
    expect(matchesEventoSearch(filter, "2026")).toBe(true);
  });

  it("sem resultado quando o termo não aparece no nome", () => {
    expect(matchesEventoSearch(filter, "black friday")).toBe(false);
  });

  it("busca vazia ou só espaços casa com tudo", () => {
    expect(matchesEventoSearch(filter, "")).toBe(true);
    expect(matchesEventoSearch(filter, "   ")).toBe(true);
  });
});

describe("statusSummaryCounts", () => {
  it("conta eventos por status", () => {
    const counts = statusSummaryCounts([
      makeFilter({ id: "a", status: "ativo" }),
      makeFilter({ id: "b", status: "ativo" }),
      makeFilter({ id: "c", status: "finalizado" }),
    ]);
    expect(counts).toEqual({ ativo: 2, finalizado: 1, cancelado: 0 });
  });
});
