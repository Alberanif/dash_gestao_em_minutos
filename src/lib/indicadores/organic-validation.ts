/**
 * Evento organico precisa de ao menos um evento de Captacao de Leads ou um
 * termo Meta Ads (produto Hotmart sozinho nao basta). Retorna a mensagem de
 * erro ou null quando valido.
 */
export function validateOrganicSources(
  metaAdsTerms: unknown[] | null | undefined,
  captacaoLeadsEventos: unknown[] | null | undefined
): string | null {
  if ((metaAdsTerms?.length ?? 0) === 0 && (captacaoLeadsEventos?.length ?? 0) === 0) {
    return "organic events require at least one of meta_ads_terms or captacao_leads_eventos";
  }
  return null;
}
