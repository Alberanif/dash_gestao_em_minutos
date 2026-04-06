export interface YouTubeCredentials {
  api_key: string;
  channel_id: string;
}

export interface InstagramCredentials {
  access_token: string;
  user_id: string;
}

export interface HotmartCredentials {
  client_id: string;
  client_secret: string;
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
  platform: "youtube" | "instagram" | "hotmart";
  name: string;
  credentials: YouTubeCredentials | InstagramCredentials | HotmartCredentials;
  is_active: boolean;
  created_at: string;
}

export interface ChannelSnapshot {
  id: string;
  account_id: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  collected_at: string;
}

export interface VideoSnapshot {
  id: string;
  account_id: string;
  video_id: string;
  title: string;
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration: string;
  thumbnail_url: string;
  collected_at: string;
  [key: string]: unknown;
}

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
