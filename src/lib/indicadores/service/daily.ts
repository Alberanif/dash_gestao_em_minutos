import type { DailyPoint } from "@/types/indicadores";
import type { ExpandedFilter, Period } from "../filter-expansion";
import { brtToUtc, utcToBrtDate } from "../timezone";
import type { SupabaseLike } from "./types";

const STATUS_APPROVED = ["COMPLETE", "APPROVED"];

export interface DailyQuery {
  period: Period;
  filter: ExpandedFilter;
}

type MetaRow = { date: string; spend: number | null; leads_all: number | null; checkout: number | null };
type MetaDay = { spend: number; leads: number; checkout: number };

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

const EMPTY_RESULT: QueryResult = { data: [], error: null };

export async function fetchDailySeries(
  { period, filter }: DailyQuery,
  supabase: SupabaseLike
): Promise<DailyPoint[]> {
  const startUtc = brtToUtc(period.startDate, false);
  const endUtc = brtToUtc(period.endDate, true);

  const hotmartQuery = filter.sources.hotmart
    ? scopedSales(filter, { startUtc, endUtc }, supabase)
    : Promise.resolve(EMPTY_RESULT);

  let metaQuery = supabase
    .from("dash_gestao_meta_ads_campaigns_daily")
    .select("date, spend, leads_all, checkout")
    .gte("date", period.startDate)
    .lte("date", period.endDate);

  if (filter.metaTerms.length > 0) {
    metaQuery = metaQuery.or(
      filter.metaTerms.map((t) => `campaign_name.ilike.%${t}%`).join(",")
    );
  }

  const leadsQuery = supabase.rpc("dash_gestao_leads_daily_counts", {
    p_start_date: period.startDate,
    p_end_date: period.endDate,
    p_eventos: filter.eventos.length > 0 ? filter.eventos : null,
  });

  const [metaResult, hotmartResult, leadsResult] = await Promise.all([
    metaQuery,
    hotmartQuery,
    leadsQuery,
  ]);

  for (const result of [metaResult, hotmartResult, leadsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const metaByDate = new Map<string, MetaDay>();
  for (const row of (metaResult.data ?? []) as MetaRow[]) {
    const day = metaByDate.get(row.date);
    if (day) {
      day.spend += row.spend ?? 0;
      day.leads += row.leads_all ?? 0;
      day.checkout += row.checkout ?? 0;
    } else {
      metaByDate.set(row.date, {
        spend: row.spend ?? 0,
        leads: row.leads_all ?? 0,
        checkout: row.checkout ?? 0,
      });
    }
  }

  // `purchase_date` é UTC; o dia da série é BRT. Sem esta volta, a venda da
  // noite cai no dia seguinte e a curva inteira desloca, em silêncio.
  const hotmartByDate = new Map<string, number>();
  for (const row of (hotmartResult.data ?? []) as { purchase_date: string }[]) {
    const date = utcToBrtDate(row.purchase_date);
    hotmartByDate.set(date, (hotmartByDate.get(date) ?? 0) + 1);
  }

  // A RPC já agrega por dia no banco — nenhum limite de linhas se aplica aqui.
  const leadsByDate = new Map<string, number>();
  for (const row of (leadsResult.data ?? []) as { date: string; count: number }[]) {
    leadsByDate.set(row.date, Number(row.count));
  }

  const dates = new Set<string>([
    ...metaByDate.keys(),
    ...hotmartByDate.keys(),
    ...leadsByDate.keys(),
    ...datesInRange(period),
  ]);

  return Array.from(dates)
    .sort()
    .map((date) => {
      const meta = metaByDate.get(date);
      const meta_spend = meta?.spend ?? 0;
      const meta_leads = meta?.leads ?? 0;

      return {
        date,
        meta_spend,
        meta_leads,
        // Investimento sem lead é ausência de CPL, não zero nem Infinity.
        meta_cpl_traffic: meta_leads > 0 ? meta_spend / meta_leads : null,
        meta_checkout: meta?.checkout ?? 0,
        hotmart_sales: hotmartByDate.get(date) ?? 0,
        lead_captacoes: leadsByDate.get(date) ?? 0,
      };
    });
}

/**
 * Vendas do período restritas ao escopo do filtro. Fonte não configurada não
 * chega aqui: é *ausência*, e devolver o total global era o que fazia a curva
 * de vendas ignorar o filtro da tela.
 */
function scopedSales(
  filter: ExpandedFilter,
  { startUtc, endUtc }: { startUtc: string; endUtc: string },
  supabase: SupabaseLike
): PromiseLike<QueryResult> {
  const query = supabase
    .from("dash_gestao_hotmart_sales")
    .select("purchase_date")
    .in("status", STATUS_APPROVED)
    .gte("purchase_date", startUtc)
    .lte("purchase_date", endUtc)
    .in("product_id", filter.productIds);

  // A oferta selecionada era descartada aqui, embora a tela já a enviasse: a
  // curva de vendas contradizia o card de Hotmart logo ao lado.
  return filter.offerCode ? query.eq("offer_code", filter.offerCode) : query;
}

/** Preenche as lacunas: todo dia do intervalo aparece na série, mesmo sem dado. */
function datesInRange({ startDate, endDate }: Period): string[] {
  const dates: string[] = [];
  const end = new Date(endDate);
  for (const d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
