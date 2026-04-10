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

export async function collectMetaAds(
  account: Account,
  startDate?: string,
  endDate?: string
): Promise<{ dailyRecords: number; campaignRecords: number }> {
  const { access_token, ad_account_id } = account.credentials as MetaAdsCredentials;
  const supabase = createSupabaseServiceClient();
  const todayStr = today();

  let since: string;
  let until: string;

  if (startDate && endDate) {
    since = startDate;
    until = endDate;
  } else {
    // Coleta incremental: busca última data coletada
    const { data: lastRow } = await supabase
      .from("dash_gestao_meta_ads_daily")
      .select("date")
      .eq("account_id", account.id)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (lastRow?.date) {
      // Re-fetch últimos 3 dias para estabilização de dados
      since = subtractDays(lastRow.date, 3);
    } else {
      // Primeira coleta: últimos 30 dias
      since = subtractDays(todayStr, 30);
    }
    until = todayStr;
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

  // 2. Snapshot de campanhas no mesmo período
  const campaignsResponse = await metaGet(
    `${ad_account_id}/insights`,
    {
      fields: "campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc,actions,action_values",
      level: "campaign",
      since,
      until,
    },
    access_token
  );

  const campaignRows = (campaignsResponse.data || []).map((row: {
    campaign_id: string;
    campaign_name: string;
    spend?: string;
    impressions?: string;
    reach?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  }) => {
    const { conversions, conversion_value } = extractConversions(row.actions, row.action_values);
    return {
      account_id: account.id,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      status: null,
      objective: null,
      spend: parseFloat(row.spend || "0"),
      impressions: parseInt(row.impressions || "0", 10),
      reach: parseInt(row.reach || "0", 10),
      clicks: parseInt(row.clicks || "0", 10),
      ctr: parseFloat(row.ctr || "0"),
      cpc: parseFloat(row.cpc || "0"),
      conversions,
      conversion_value,
      collected_date: todayStr,
    };
  });

  let campaignRecords = 0;
  if (campaignRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_meta_ads_campaigns")
      .upsert(campaignRows, { onConflict: "account_id,campaign_id,collected_date" });
    if (error) throw new Error(`Campaign upsert error: ${error.message}`);
    campaignRecords = campaignRows.length;
  }

  return { dailyRecords, campaignRecords };
}
