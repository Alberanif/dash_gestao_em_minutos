import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, MetaAdsCredentials } from "@/types/accounts";

const META_API_BASE = "https://graph.facebook.com/v21.0";

const CONVERSION_ACTION_TYPES = new Set([
  "purchase",
  "lead",
  "offsite_conversion.fb_pixel_purchase",
  "offsite_conversion.fb_pixel_lead",
]);

async function metaGet(endpoint: string, params: Record<string, string>, accessToken: string) {
  const url = new URL(`${META_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Meta Ads API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function metaGetAllPages<T>(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = null;

  const first = await metaGet(endpoint, params, accessToken);
  all.push(...(first.data ?? []));
  nextUrl = first.paging?.next ?? null;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      throw new Error(`Meta Ads API error (pagination): ${res.status} ${await res.text()}`);
    }
    const page = await res.json();
    all.push(...(page.data ?? []));
    nextUrl = page.paging?.next ?? null;
  }

  return all;
}

function extractConversions(
  actions: Array<{ action_type: string; value: string }> | undefined,
  actionValues: Array<{ action_type: string; value: string }> | undefined
): { conversions: number; conversion_value: number } {
  let conversions = 0;
  let conversion_value = 0;

  if (actions) {
    for (const action of actions) {
      if (CONVERSION_ACTION_TYPES.has(action.action_type)) {
        conversions += parseFloat(action.value) || 0;
      }
    }
  }

  if (actionValues) {
    for (const av of actionValues) {
      if (CONVERSION_ACTION_TYPES.has(av.action_type)) {
        conversion_value += parseFloat(av.value) || 0;
      }
    }
  }

  return { conversions: Math.round(conversions), conversion_value };
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  return subtractDays(today(), 1);
}

export async function collectMetaAds(
  account: Account,
  startDate?: string,
  endDate?: string
): Promise<{ dailyRecords: number; campaignDailyRecords: number }> {
  const { access_token, ad_account_id } = account.credentials as MetaAdsCredentials;
  const supabase = createSupabaseServiceClient();
  const todayStr = today();
  const yesterdayStr = yesterday();

  let since: string;
  let until: string;
  let campaignSince: string;
  let campaignUntil: string;

  if (startDate && endDate) {
    since = startDate;
    until = endDate;
    campaignSince = startDate;
    campaignUntil = endDate;
  } else {
    // Account-level daily: incremental from last collected date
    const { data: lastDailyRow } = await supabase
      .from("dash_gestao_meta_ads_daily")
      .select("date")
      .eq("account_id", account.id)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    since = lastDailyRow?.date ? subtractDays(lastDailyRow.date, 3) : subtractDays(todayStr, 30);
    until = todayStr;

    // Campaign daily: ceiling at D-1 — today's data is partial and unreliable
    const { data: lastCampaignRow } = await supabase
      .from("dash_gestao_meta_ads_campaigns_daily")
      .select("date")
      .eq("account_id", account.id)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    campaignSince = lastCampaignRow?.date
      ? subtractDays(lastCampaignRow.date, 3)
      : subtractDays(yesterdayStr, 30);
    campaignUntil = yesterdayStr;
  }

  // 1. Métricas diárias a nível de conta
  const insightsResponse = await metaGet(
    `${ad_account_id}/insights`,
    {
      fields: "spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values",
      level: "account",
      time_increment: "1",
      since,
      until,
    },
    access_token
  );

  const dailyRows = (insightsResponse.data || []).map((row: {
    date_start: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  }) => {
    const { conversions, conversion_value } = extractConversions(row.actions, row.action_values);
    return {
      account_id: account.id,
      date: row.date_start,
      spend: parseFloat(row.spend || "0"),
      impressions: parseInt(row.impressions || "0", 10),
      reach: parseInt(row.reach || "0", 10),
      clicks: parseInt(row.clicks || "0", 10),
      ctr: parseFloat(row.ctr || "0"),
      cpc: parseFloat(row.cpc || "0"),
      cpm: parseFloat(row.cpm || "0"),
      conversions,
      conversion_value,
    };
  });

  let dailyRecords = 0;
  if (dailyRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_meta_ads_daily")
      .upsert(dailyRows, { onConflict: "account_id,date" });
    if (error) throw new Error(`Daily upsert error: ${error.message}`);
    dailyRecords = dailyRows.length;
  }

  // 2. Métricas diárias a nível de campanha (teto D-1 para estabilidade dos dados)
  const campaignsData = await metaGetAllPages<{
    campaign_id: string;
    campaign_name: string;
    date_start: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  }>(
    `${ad_account_id}/insights`,
    {
      fields: "campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values",
      level: "campaign",
      time_increment: "1",
      since: campaignSince,
      until: campaignUntil,
    },
    access_token
  );

  const campaignDailyRows = campaignsData.map((row) => {
    const { conversions, conversion_value } = extractConversions(row.actions, row.action_values);
    return {
      account_id: account.id,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      date: row.date_start,
      spend: parseFloat(row.spend || "0"),
      impressions: parseInt(row.impressions || "0", 10),
      reach: parseInt(row.reach || "0", 10),
      clicks: parseInt(row.clicks || "0", 10),
      ctr: parseFloat(row.ctr || "0"),
      cpm: parseFloat(row.cpm || "0"),
      conversions,
      conversion_value,
    };
  });

  let campaignDailyRecords = 0;
  if (campaignDailyRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_meta_ads_campaigns_daily")
      .upsert(campaignDailyRows, { onConflict: "account_id,campaign_id,date" });
    if (error) throw new Error(`Campaign daily upsert error: ${error.message}`);
    campaignDailyRecords = campaignDailyRows.length;
  }

  return { dailyRecords, campaignDailyRecords };
}
