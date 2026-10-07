import {
  buildViewDailyCumulative,
  describeBackfill,
  groupViewsByFolder,
  incompleteBadge,
  normalizeOfferCode,
  selectInitialViewId,
  totalsMismatch,
} from "../views";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";

function view(id: string, created_at: string, folder_id: string | null = null): VendasViewRecord {
  return {
    id,
    name: `V ${id}`,
    account_id: "a",
    product_id: "p",
    offer_codes: ["o1"],
    folder_id,
    view_start_date: null,
    view_end_date: null,
    refresh_started_at: null,
    last_refresh_at: null,
    backfill_status: "done",
    backfill_from: null,
    migrated_from_cycle_id: null,
    created_by: null,
    created_at,
    updated_at: created_at,
  };
}

const folder = (id: string, name: string): VendasFolderRecord =>
  ({ id, name, created_by: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }) as unknown as VendasFolderRecord;

describe("selectInitialViewId", () => {
  it("abre a visualização mais recente por created_at, independente da ordem da lista", () => {
    const list = [view("velha", "2026-01-01T00:00:00Z"), view("nova", "2026-03-01T00:00:00Z"), view("meio", "2026-02-01T00:00:00Z")];
    expect(selectInitialViewId(list)).toBe("nova");
  });
  it("lista vazia → null", () => {
    expect(selectInitialViewId([])).toBeNull();
  });
});

describe("groupViewsByFolder", () => {
  it("ordena pastas A-Z, views por created_at desc, 'Sem pasta' por último, e expande o grupo da selecionada", () => {
    const folders = [folder("fb", "Beta"), folder("fa", "Alfa")];
    const views = [
      view("a-velha", "2026-01-01T00:00:00Z", "fa"),
      view("a-nova", "2026-02-01T00:00:00Z", "fa"),
      view("b1", "2026-01-15T00:00:00Z", "fb"),
      view("solta", "2026-01-20T00:00:00Z"),
    ];
    const groups = groupViewsByFolder(views, folders, "b1");
    expect(groups.map((g) => g.name)).toEqual(["Alfa", "Beta", "Sem pasta"]);
    expect(groups[0].items.map((v) => v.id)).toEqual(["a-nova", "a-velha"]);
    expect(groups.filter((g) => g.isExpanded).map((g) => g.id)).toEqual(["fb"]);
  });
});

describe("totalsMismatch", () => {
  const daily = [{ day: "2026-08-01", sales: 3 }, { day: "2026-08-02", sales: 4 }];
  const offers = [
    { offer_code: "a", offer_name: null, sales: 5, refunded: 0 },
    { offer_code: "b", offer_name: null, sales: 2, refunded: 1 },
  ];
  it("KPI = soma do dia = soma das ofertas → sem divergência", () => {
    expect(totalsMismatch(7, daily, offers)).toBeNull();
  });
  it("qualquer fonte divergente é reportada com os três totais", () => {
    expect(totalsMismatch(8, daily, offers)).toEqual({ kpi: 8, daily: 7, offers: 7 });
    expect(totalsMismatch(7, daily, [{ ...offers[0], sales: 9 }, offers[1]])).toEqual({ kpi: 7, daily: 7, offers: 11 });
  });
});

describe("describeBackfill", () => {
  it("só 'done' é histórico completo; pending/running/partial/failed marcam o número como incompleto", () => {
    expect(describeBackfill({ backfill_status: "done", backfill_from: null }).incomplete).toBe(false);
    for (const status of ["pending", "running", "partial", "failed"] as const) {
      expect(describeBackfill({ backfill_status: status, backfill_from: "2026-07-01" }).incomplete).toBe(true);
    }
  });
  it("parcial informa a data inicial; falha oferece retry; coletando não", () => {
    expect(describeBackfill({ backfill_status: "partial", backfill_from: "2026-07-01" }).message).toContain("01/07/2026");
    expect(describeBackfill({ backfill_status: "failed", backfill_from: null }).canRetry).toBe(true);
    expect(describeBackfill({ backfill_status: "running", backfill_from: null }).canRetry).toBe(false);
    expect(describeBackfill({ backfill_status: "running", backfill_from: null }).message).toBe("Coletando histórico…");
  });
  it("incompleteBadge é null só quando completo", () => {
    expect(incompleteBadge(describeBackfill({ backfill_status: "done", backfill_from: null }))).toBeNull();
    expect(incompleteBadge(describeBackfill({ backfill_status: "partial", backfill_from: "2026-07-01" }))).toBe("Histórico parcial");
  });
});

describe("buildViewDailyCumulative", () => {
  it("acumula as vendas do dia em ordem cronológica", () => {
    const pts = buildViewDailyCumulative([
      { day: "2026-08-02", sales: 4 },
      { day: "2026-08-01", sales: 3 },
    ]);
    expect(pts).toEqual([
      { key: "2026-08-01", cumulative: 3 },
      { key: "2026-08-02", cumulative: 7 },
    ]);
  });
});

describe("normalizeOfferCode", () => {
  it("trim e vazio → null", () => {
    expect(normalizeOfferCode("  abc ")).toBe("abc");
    expect(normalizeOfferCode("   ")).toBeNull();
  });
});
