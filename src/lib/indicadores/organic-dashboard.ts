import type { FilterRecord, GlobalMetrics } from "@/types/indicadores";

/** Evento organico: sem Hotmart, sem ROAS/Receita/Vendas na tela. */
export function isOrganicFilter(filter: FilterRecord | null | undefined): boolean {
  return filter?.is_organic === true;
}

/**
 * Fetches de Hotmart e origens de conversao so existem no modo pago: a tela
 * organica nao os usa, entao nem sao disparados.
 */
export function shouldFetchHotmart(hasHotmartFilter: boolean, isOrganic: boolean): boolean {
  return hasHotmartFilter && !isOrganic;
}

export type DashboardSectionKey = "resultado" | "jornada" | "plataformas" | "captacao";

export interface DashboardSectionSlot {
  key: DashboardSectionKey;
  /** Indice exibido no SectionHeader ("01", "02", ...). */
  index: string;
}

const PAID_ORDER: DashboardSectionKey[] = ["resultado", "jornada", "plataformas", "captacao"];
const ORGANIC_ORDER: DashboardSectionKey[] = ["resultado", "captacao", "jornada", "plataformas"];

/** Ordem e numeracao das secoes; o modo pago permanece 01-04 como sempre foi. */
export function dashboardSectionLayout(isOrganic: boolean): DashboardSectionSlot[] {
  return (isOrganic ? ORGANIC_ORDER : PAID_ORDER).map((key, i) => ({
    key,
    index: String(i + 1).padStart(2, "0"),
  }));
}

export interface OrganicResultKpis {
  /** Mesmo total do card Captacao de Leads (leadsState.data.total). */
  leads: number;
  /** Investimento Meta Ads; null quando o evento nao tem fonte Meta. */
  investment: number | null;
  /** Mesma origem do CPL da Jornada (meta_cpl_traffic); null vira "—". */
  cpl: number | null;
}

export function organicResultKpis(input: {
  leadsTotal: number;
  metaData: GlobalMetrics | null;
  hasMetaFilter: boolean;
}): OrganicResultKpis {
  const { leadsTotal, metaData, hasMetaFilter } = input;
  return {
    leads: leadsTotal,
    investment: hasMetaFilter ? (metaData?.meta_spend ?? null) : null,
    cpl: hasMetaFilter ? (metaData?.meta_cpl_traffic ?? null) : null,
  };
}
