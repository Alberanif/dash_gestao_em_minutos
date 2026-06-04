import type { FilterRecord } from "@/types/indicadores";

export interface SourceFlags {
  hasMetaFilter: boolean;
  hasHotmartFilter: boolean;
}

/**
 * Derives which data sources are configured in a given filter.
 * Pure function — no side effects, fully testable.
 */
export function deriveSourceFlags(filter: FilterRecord): SourceFlags {
  return {
    hasMetaFilter: filter.meta_ads_terms.length > 0,
    hasHotmartFilter: filter.hotmart_products.length > 0,
  };
}
