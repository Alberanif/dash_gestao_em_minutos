export interface YouTubeCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  channel_id: string;            // informado pelo usuário no cadastro
  uploads_playlist_id?: string;  // populado automaticamente ao validar o canal (opcional para compatibilidade com contas existentes)
  history_start_date: string;    // YYYY-MM-DD — backfill start
  // auto-managed by getValidAccessToken:
  access_token?: string;
  access_token_expiry?: string;  // ISO timestamp
}

export interface InstagramCredentials {
  access_token: string;
  user_id: string;
}

export interface HotmartCredentials {
  client_id: string;
  client_secret: string;
}

export interface MetaAdsCredentials {
  access_token: string;
  ad_account_id: string; // ex: "act_3689989500461"
}

export interface HotmartSale {
  id: string;
  account_id: string;
  transaction_code: string;
  product_id: string;
  product_name: string;
  offer_code: string | null;
  offer_name: string | null;
  status: string;
  price: number;
  currency: string;
  purchase_date: string;
  approved_date: string | null;
  buyer_email: string;
  collected_at: string;
  [key: string]: unknown;
}

export interface Account {
  id: string;
  platform: "youtube" | "instagram" | "hotmart" | "meta-ads";
  name: string;
  credentials: YouTubeCredentials | InstagramCredentials | HotmartCredentials | MetaAdsCredentials;
  is_active: boolean;
  created_at: string;
}

export interface MetaAdsDailyRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversion_value: number;
  collected_at: string;
}

export interface MetaAdsCampaign extends Record<string, unknown> {
  id: string;
  account_id: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  objective: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
  collected_date: string;
}

// YouTube Analytics daily rows
export interface ChannelDailyRow extends Record<string, unknown> {
  id: string;
  account_id: string;
  date: string;
  views: number;
  estimated_minutes_watched: number;
  average_view_duration: number;
  average_view_percentage: number;
  subscribers_gained: number;
  subscribers_lost: number;
  subscriber_count: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface VideoMetadata {
  id: string;
  account_id: string;
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
}

export interface VideoAggregated extends Record<string, unknown> {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
  total_views: number;
  total_watch_min: number;
  avg_view_percentage: number;
  avg_view_duration: number;
  total_likes: number;
  total_comments: number;
}

// Instagram (unchanged)
export interface ProfileSnapshot {
  id: string;
  account_id: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  impressions: number;
  reach: number;
  collected_at: string;
}

export interface MediaSnapshot {
  id: string;
  account_id: string;
  media_id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL" | "REEL" | "STORY";
  caption: string | null;
  permalink: string | null;
  like_count: number;
  comments_count: number;
  reach: number;
  impressions: number;
  saved: number;
  shares: number;
  plays: number;
  published_at: string;
  collected_at: string;
  [key: string]: unknown;
}
