import type {
  GlobalMetrics,
  GlobalHotmartMetrics,
  GlobalLeadsMetrics,
  DailyPoint,
} from "@/types/indicadores";

export type ToolParams = { startDate: string; endDate: string; filterId: string };
export type AuthHeaders = Record<string, string>;

const BASE_URL = "http://localhost:3000";

function buildUrl(path: string, params: ToolParams): string {
  return `${BASE_URL}${path}?start_date=${params.startDate}&end_date=${params.endDate}&filter_id=${params.filterId}`;
}

async function fetchTool<T>(url: string, authHeaders: AuthHeaders, errorLabel: string): Promise<T> {
  const response = await fetch(url, { headers: authHeaders });
  if (!response.ok) {
    throw new Error(`Erro ao buscar dados de ${errorLabel}: status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getMetaAdsMetrics(
  params: ToolParams,
  authHeaders: AuthHeaders
): Promise<GlobalMetrics> {
  const url = buildUrl("/api/indicadores/metrics", params);
  return fetchTool<GlobalMetrics>(url, authHeaders, "Meta Ads");
}

export async function getHotmartMetrics(
  params: ToolParams,
  authHeaders: AuthHeaders
): Promise<GlobalHotmartMetrics> {
  const url = buildUrl("/api/indicadores/hotmart", params);
  return fetchTool<GlobalHotmartMetrics>(url, authHeaders, "Hotmart");
}

export async function getLeadsMetrics(
  params: ToolParams,
  authHeaders: AuthHeaders
): Promise<GlobalLeadsMetrics> {
  const url = buildUrl("/api/indicadores/leads", params);
  return fetchTool<GlobalLeadsMetrics>(url, authHeaders, "Leads");
}

export async function getDailySeries(
  params: ToolParams,
  authHeaders: AuthHeaders
): Promise<DailyPoint[]> {
  const url = buildUrl("/api/indicadores/daily", params);
  return fetchTool<DailyPoint[]>(url, authHeaders, "série diária");
}
