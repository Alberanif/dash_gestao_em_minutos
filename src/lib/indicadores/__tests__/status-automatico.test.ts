import type { FilterRecord } from "@/types/indicadores";
import { aplicarStatusAutomatico, eventoVencido, hojeBrt } from "../status-automatico";

function evento(parcial: Partial<FilterRecord>): FilterRecord {
  return {
    id: "e1",
    account_id: "a1",
    name: "Evento",
    hotmart_products: [],
    meta_ads_terms: [],
    captacao_leads_eventos: [],
    is_organic: false,
    start_date: "2026-10-01",
    end_date: "2026-10-10",
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
    ...parcial,
  } as FilterRecord;
}

// 10/10 23:59 em Brasília = 11/10 02:59 UTC; 11/10 00:00 em Brasília = 11/10 03:00 UTC.
const NO_DIA_DO_FIM = new Date("2026-10-11T02:59:00Z");
const MEIA_NOITE_SEGUINTE = new Date("2026-10-11T03:00:00Z");

describe("hojeBrt", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    expect(hojeBrt(NO_DIA_DO_FIM)).toBe("2026-10-10");
    expect(hojeBrt(MEIA_NOITE_SEGUINTE)).toBe("2026-10-11");
  });
});

describe("eventoVencido", () => {
  it("sem data de fim nunca vence", () => {
    expect(eventoVencido(null, "2030-01-01")).toBe(false);
    expect(eventoVencido(undefined, "2030-01-01")).toBe(false);
  });
  it("o próprio dia de fim ainda não venceu", () => {
    expect(eventoVencido("2026-10-10", "2026-10-10")).toBe(false);
    expect(eventoVencido("2026-10-10", "2026-10-11")).toBe(true);
  });
});

describe("aplicarStatusAutomatico", () => {
  it("mantém ativo durante todo o último dia", () => {
    const f = evento({});
    expect(aplicarStatusAutomatico(f, NO_DIA_DO_FIM)).toBe(f);
  });

  it("finaliza à meia-noite seguinte, com o end_date como data da mudança", () => {
    const r = aplicarStatusAutomatico(evento({}), MEIA_NOITE_SEGUINTE);
    expect(r.status).toBe("finalizado");
    expect(r.status_automatico).toBe(true);
    expect(new Date(r.status_changed_at as string).toISOString()).toBe("2026-10-11T02:59:59.000Z");
  });

  it("não mexe em cancelado", () => {
    const f = evento({ status: "cancelado", status_changed_at: "2026-10-05T12:00:00Z" });
    expect(aplicarStatusAutomatico(f, new Date("2027-01-01T00:00:00Z"))).toBe(f);
  });

  it("preserva a data de um finalizado manual", () => {
    const f = evento({ status: "finalizado", status_changed_at: "2026-10-05T12:00:00Z" });
    expect(aplicarStatusAutomatico(f, new Date("2027-01-01T00:00:00Z"))).toBe(f);
  });

  it("sem end_date nunca finaliza sozinho", () => {
    const f = evento({ start_date: null, end_date: null });
    expect(aplicarStatusAutomatico(f, new Date("2030-01-01T00:00:00Z"))).toBe(f);
  });
});
