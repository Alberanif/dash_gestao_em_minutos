import {
  isOrganicFilter,
  shouldFetchHotmart,
  dashboardSectionLayout,
  organicResultKpis,
} from "../organic-dashboard";
import type { FilterRecord, GlobalMetrics } from "@/types/indicadores";

describe("isOrganicFilter", () => {
  it("só é verdadeiro para is_organic === true", () => {
    expect(isOrganicFilter({ is_organic: true } as FilterRecord)).toBe(true);
    expect(isOrganicFilter({ is_organic: false } as FilterRecord)).toBe(false);
    expect(isOrganicFilter(null)).toBe(false);
  });
});

describe("shouldFetchHotmart", () => {
  it("não busca Hotmart no modo orgânico, mesmo com produto", () => {
    expect(shouldFetchHotmart(true, true)).toBe(false);
  });
  it("modo pago segue a configuração da fonte", () => {
    expect(shouldFetchHotmart(true, false)).toBe(true);
    expect(shouldFetchHotmart(false, false)).toBe(false);
  });
});

describe("dashboardSectionLayout", () => {
  it("pago: Resultado, Jornada, Plataformas, Captação (01-04)", () => {
    expect(dashboardSectionLayout(false)).toEqual([
      { key: "resultado", index: "01" },
      { key: "jornada", index: "02" },
      { key: "plataformas", index: "03" },
      { key: "captacao", index: "04" },
    ]);
  });
  it("orgânico: Resultado, Captação, Jornada, Plataformas renumerados", () => {
    expect(dashboardSectionLayout(true)).toEqual([
      { key: "resultado", index: "01" },
      { key: "captacao", index: "02" },
      { key: "jornada", index: "03" },
      { key: "plataformas", index: "04" },
    ]);
  });
});

describe("organicResultKpis", () => {
  const meta = { meta_spend: 500, meta_cpl_traffic: 2.5 } as GlobalMetrics;

  it("leads vêm do total de Captação; investimento e CPL do Meta (mesmo CPL da Jornada)", () => {
    expect(organicResultKpis({ leadsTotal: 200, metaData: meta, hasMetaFilter: true })).toEqual({
      leads: 200,
      investment: 500,
      cpl: 2.5,
    });
  });
  it("CPL nulo (sem leads) permanece nulo para exibir —", () => {
    const noLeads = { meta_spend: 500, meta_cpl_traffic: null } as GlobalMetrics;
    expect(organicResultKpis({ leadsTotal: 0, metaData: noLeads, hasMetaFilter: true }).cpl).toBeNull();
  });
  it("sem fonte Meta, investimento e CPL são nulos", () => {
    expect(organicResultKpis({ leadsTotal: 10, metaData: meta, hasMetaFilter: false })).toEqual({
      leads: 10,
      investment: null,
      cpl: null,
    });
  });
});
