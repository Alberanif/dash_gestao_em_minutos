// src/lib/services/youtube.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/youtube/auth";
import {
  queryChannelDaily,
  queryVideoDaily,
  fetchVideoMetadata,
} from "@/lib/youtube/analytics";
import type { Account, YouTubeCredentials } from "@/types/accounts";

async function detectSyncRange(
  account: Account
): Promise<{ start: string; end: string }> {
  const creds = account.credentials as YouTubeCredentials;
  const today = new Date().toISOString().slice(0, 10);
  const supabase = createSupabaseServiceClient();

  const { data } = await supabase
    .from("dash_gestao_youtube_channel_daily")
    .select("date")
    .eq("account_id", account.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    // No existing data → full backfill from history_start_date
    return { start: creds.history_start_date, end: today };
  }

  // Incremental: re-fetch last 3 days to cover the data stabilisation window
  const lastDate = new Date(data.date);
  lastDate.setDate(lastDate.getDate() - 3);
  return { start: lastDate.toISOString().slice(0, 10), end: today };
}

export async function collectYouTube(account: Account): Promise<{
  channelRecords: number;
  videoRecords: number;
}> {
  const creds = account.credentials as YouTubeCredentials;
  const supabase = createSupabaseServiceClient();

  // 1. Ensure we have a valid access token (refreshes automatically if needed)
  const accessToken = await getValidAccessToken(account);

  // 2. Determine what date range to collect
  const syncRange = await detectSyncRange(account);

  // 3. Collect channel-level daily metrics
  const channelRows = await queryChannelDaily(
    accessToken,
    creds.channel_id,
    syncRange.start,
    syncRange.end
  );

  // 4. Collect video-level daily metrics
  const videoRows = await queryVideoDaily(
    accessToken,
    creds.channel_id,
    syncRange.start,
    syncRange.end
  );

  // 5. Fetch metadata only for video_ids not yet in the videos table
  if (videoRows.length > 0) {
    const allVideoIds = [...new Set(videoRows.map((r) => r.video_id))];

    const { data: existing } = await supabase
      .from("dash_gestao_youtube_videos")
      .select("video_id")
      .eq("account_id", account.id)
      .in("video_id", allVideoIds);

    const existingSet = new Set((existing ?? []).map((v) => v.video_id));
    const newVideoIds = allVideoIds.filter((id) => !existingSet.has(id));

    if (newVideoIds.length > 0) {
      const metadata = await fetchVideoMetadata(accessToken, newVideoIds);
      if (metadata.length > 0) {
        const { error } = await supabase
          .from("dash_gestao_youtube_videos")
          .upsert(
            metadata.map((m) => ({
              account_id: account.id,
              video_id: m.video_id,
              title: m.title,
              published_at: m.published_at,
              thumbnail_url: m.thumbnail_url,
              duration: m.duration,
            })),
            { onConflict: "account_id,video_id" }
          );
        if (error) throw new Error(`Video metadata upsert: ${error.message}`);
      }
    }
  }

  // 6. Upsert channel daily metrics (idempotent via UNIQUE on account_id, date)
  if (channelRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_youtube_channel_daily")
      .upsert(
        channelRows.map((r) => ({ account_id: account.id, ...r })),
        { onConflict: "account_id,date" }
      );
    if (error) throw new Error(`Channel daily upsert: ${error.message}`);
  }

  // 7. Upsert video daily metrics
  if (videoRows.length > 0) {
    const { error } = await supabase
      .from("dash_gestao_youtube_video_daily")
      .upsert(
        videoRows.map((r) => ({ account_id: account.id, ...r })),
        { onConflict: "account_id,video_id,date" }
      );
    if (error) throw new Error(`Video daily upsert: ${error.message}`);
  }

  return {
    channelRecords: channelRows.length,
    videoRecords: videoRows.length,
  };
}
