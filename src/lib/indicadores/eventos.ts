// Domain lib pura da tela Eventos (Seletor de Projetos).
// "Evento" = filtro salvo do dashboard Indicadores (FilterRecord).
// Sem I/O: entrada FilterRecord[], saída dados prontos para a UI.

import type { FilterRecord, FilterStatus } from "@/types/indicadores";

export type FilterGroups = Record<FilterStatus, FilterRecord[]>;

/** "2026-07-01T12:00:00Z" → "01/07/2026" (parte de data do ISO, sem conversão de fuso). */
function formatDateBR(isoTimestamp: string): string {
  const [year, month, day] = isoTimestamp.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function eventoMetaLine(filter: FilterRecord): string {
  const statusDate = formatDateBR(filter.status_changed_at ?? filter.created_at);
  switch (filter.status) {
    case "finalizado":
      return `Encerrado em ${statusDate}`;
    case "cancelado":
      return `Cancelado em ${statusDate}`;
    default:
      return `Criado em ${formatDateBR(filter.created_at)} · em andamento`;
  }
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "N produtos · N campanhas · N eventos de captação", omitindo partes zeradas. */
export function eventoCompositionSubtitle(filter: FilterRecord): string {
  const products = filter.hotmart_products.length;
  const campaigns = filter.meta_ads_terms.filter((t) => t.trim() !== "").length;
  const eventos = filter.captacao_leads_eventos.length;

  const parts: string[] = [];
  if (products > 0) parts.push(plural(products, "produto", "produtos"));
  if (campaigns > 0) parts.push(plural(campaigns, "campanha", "campanhas"));
  if (eventos > 0) parts.push(plural(eventos, "evento de captação", "eventos de captação"));
  return parts.join(" · ");
}

export function groupFiltersByStatus(filters: FilterRecord[]): FilterGroups {
  const groups: FilterGroups = { ativo: [], finalizado: [], cancelado: [] };
  for (const filter of filters) {
    const bucket = groups[filter.status] ?? groups.ativo;
    bucket.push(filter);
  }
  return groups;
}

/** Busca client-side por nome: case-insensitive, match parcial; vazia casa com tudo. */
export function matchesEventoSearch(filter: FilterRecord, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return filter.name.toLowerCase().includes(term);
}

export function statusSummaryCounts(filters: FilterRecord[]): Record<FilterStatus, number> {
  const groups = groupFiltersByStatus(filters);
  return {
    ativo: groups.ativo.length,
    finalizado: groups.finalizado.length,
    cancelado: groups.cancelado.length,
  };
}
