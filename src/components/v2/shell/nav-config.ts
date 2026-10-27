function normaliza(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Título do cabeçalho para a rota atual. */
export function tituloDaRota(pathname: string): string {
  const p = normaliza(pathname);
  if (p === "/v2/_kit") return "Kit de componentes";
  if (p === "/v2/indicadores/testes-ab" || p.startsWith("/v2/indicadores/testes-ab/")) return "Testes A/B";
  if (p === "/v2/indicadores" || p.startsWith("/v2/indicadores/")) return "Indicadores";
  if (p === "/v2/central-de-links" || p.startsWith("/v2/central-de-links/")) return "Central de links";
  return "Dash V2";
}
