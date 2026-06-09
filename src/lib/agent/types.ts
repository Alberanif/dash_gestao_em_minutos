import type {
  FilterRecord,
  GlobalMetrics,
  GlobalHotmartMetrics,
  GlobalLeadsMetrics,
} from "@/types/indicadores";

export interface DashboardContext {
  activeFilter: FilterRecord | null;
  startDate: string;
  endDate: string;
  activePreset: string | null;
  metaData: GlobalMetrics | null;
  hotmartData: GlobalHotmartMetrics | null;
  leadsData: GlobalLeadsMetrics | null;
}
