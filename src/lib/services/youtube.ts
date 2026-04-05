import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, YouTubeCredentials } from "@/types/accounts";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeChannelStats {
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails: { medium: { url: string } };
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails: {
    duration: string;
  };
}

async function youtubeGet(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string
) {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectYouTube(account: Account): Promise<{
  channelRecords: number;
  videoRecords: number;
}> {
  const { api_key, channel_id } = account.credentials as YouTubeCredentials;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  // 1. Fetch channel statistics
  const channelData = await youtubeGet(
    "channels",
    { part: "statistics", id: channel_id },
    api_key
  );

  const stats: YouTubeChannelStats = channelData.items[0].statistics;

  const { error: channelError } = await supabase
    .from("dash_gestao_youtube_channel_snapshots")
    .insert({
      account_id: account.id,
      subscriber_count: parseInt(stats.subscriberCount),
      view_count: parseInt(stats.viewCount),
      video_count: parseInt(stats.videoCount),
      collected_at: now,
    });

  if (channelError) throw new Error(`Channel insert error: ${channelError.message}`);

  // 2. Fetch recent videos (last 50)
  const searchData = await youtubeGet(
    "search",
    { part: "id", channelId: channel_id, order: "date", maxResults: "50", type: "video" },
    api_key
  );

  const videoIds: string[] = searchData.items.map(
    (item: { id: { videoId: string } }) => item.id.videoId
  );

  if (videoIds.length === 0) {
    return { channelRecords: 1, videoRecords: 0 };
  }

  // 3. Fetch video details
  const videosData = await youtubeGet(
    "videos",
    { part: "snippet,statistics,contentDetails", id: videoIds.join(",") },
    api_key
  );

  const videoRows = videosData.items.map((video: YouTubeVideoItem) => ({
    account_id: account.id,
    video_id: video.id,
    title: video.snippet.title,
    published_at: video.snippet.publishedAt,
    view_count: parseInt(video.statistics.viewCount || "0"),
    like_count: parseInt(video.statistics.likeCount || "0"),
    comment_count: parseInt(video.statistics.commentCount || "0"),
    duration: video.contentDetails.duration,
    thumbnail_url: video.snippet.thumbnails.medium.url,
    collected_at: now,
  }));

  const { error: videosError } = await supabase
    .from("dash_gestao_youtube_video_snapshots")
    .insert(videoRows);

  if (videosError) throw new Error(`Videos insert error: ${videosError.message}`);

  return { channelRecords: 1, videoRecords: videoRows.length };
}
