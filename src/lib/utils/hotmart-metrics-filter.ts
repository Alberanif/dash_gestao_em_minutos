/**
 * Build the URL (pathname + query string) for the hotmart metrics API endpoint.
 * Uses a dummy base so that `new URL()` can parse relative paths correctly.
 */
export function buildHotmartMetricsUrl(
  baseUrl: string,
  params: {
    start_date: string;
    end_date: string;
    product_ids?: string[];
    offer_code?: string | null;
  }
): string {
  const url = new URL(baseUrl, "http://localhost");
  url.searchParams.set("start_date", params.start_date);
  url.searchParams.set("end_date", params.end_date);
  if (params.product_ids?.length) {
    params.product_ids.forEach((id) => url.searchParams.append("product_ids[]", id));
  }
  if (params.offer_code) {
    url.searchParams.set("offer_code", params.offer_code);
  }
  return url.pathname + url.search;
}
