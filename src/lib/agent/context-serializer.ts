import type { DashboardContext } from "./types";

export function serializeDashboardContext(ctx: DashboardContext): string {
  const lines: string[] = [];

  // Filter
  if (ctx.activeFilter) {
    lines.push(`Filtro ativo: ${ctx.activeFilter.name}`);
  } else {
    lines.push("Nenhum filtro ativo");
  }

  // Period
  lines.push(`Período: ${ctx.startDate} a ${ctx.endDate}`);
  if (ctx.activePreset) {
    lines.push(`Preset: ${ctx.activePreset}`);
  }

  // Meta Ads
  if (ctx.metaData) {
    lines.push(`Meta Ads - Spend: ${ctx.metaData.meta_spend}`);
    lines.push(`Meta Ads - Leads: ${ctx.metaData.meta_leads}`);
    lines.push(`Meta Ads - CPL Tráfego: ${ctx.metaData.meta_cpl_traffic}`);
    lines.push(`Meta Ads - Impressões: ${ctx.metaData.meta_impressions}`);
    lines.push(`Meta Ads - Link Clicks: ${ctx.metaData.meta_link_clicks}`);
  } else {
    lines.push("Meta Ads indisponível");
  }

  // Hotmart
  if (ctx.hotmartData) {
    lines.push(`Hotmart - Receita total: ${ctx.hotmartData.total_revenue}`);
    lines.push(`Hotmart - Vendas totais: ${ctx.hotmartData.total_sales}`);
  } else {
    lines.push("Hotmart indisponível");
  }

  // Leads
  if (ctx.leadsData) {
    lines.push(`Leads - Total: ${ctx.leadsData.total}`);
  } else {
    lines.push("Leads indisponível");
  }

  return lines.join("\n");
}
