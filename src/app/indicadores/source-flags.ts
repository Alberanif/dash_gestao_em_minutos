import type { FilterRecord } from "@/types/indicadores";

export interface SourceFlags {
  hasMetaFilter: boolean;
  hasHotmartFilter: boolean;
  hasLeadsFilter: boolean;
}

export function deriveSourceFlags(filter: FilterRecord): SourceFlags {
  return {
    hasMetaFilter: filter.meta_ads_terms.length > 0,
    hasHotmartFilter: filter.hotmart_products.length > 0,
    hasLeadsFilter: (filter.captacao_leads_eventos ?? []).length > 0,
  };
}
