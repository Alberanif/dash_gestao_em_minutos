import { createSupabaseServiceClient } from "@/lib/supabase/server";

const IG_API_BASE = "https://graph.facebook.com/v21.0";

async function igGet(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${IG_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", process.env.INSTAGRAM_ACCESS_TOKEN!);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectInstagramProfile(): Promise<{
  profileRecords: number;
  mediaRecords: number;
}> {
  const userId = process.env.INSTAGRAM_USER_ID!;
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  // 1. Fetch profile data
  const profile = await igGet(userId, {
    fields: "followers_count,follows_count,media_count",
  });

  // 2. Fetch profile insights (impressions, reach) for last 28 days
  let impressions = 0;
  let reach = 0;
  try {
    const insights = await igGet(`${userId}/insights`, {
      metric: "impressions,reach",
      period: "day",
      since: String(Math.floor(Date.now() / 1000) - 28 * 86400),
      until: String(Math.floor(Date.now() / 1000)),
    });
    for (const metric of insights.data) {
      const total = metric.values.reduce(
        (sum: number, v: { value: number }) => sum + v.value,
        0
      );
      if (metric.name === "impressions") impressions = total;
      if (metric.name === "reach") reach = total;
    }
  } catch {
    // Insights may not be available — continue with zeros
  }

  const { error: profileError } = await supabase
    .from("dash_gestao_instagram_profile")
    .insert({
      ig_user_id: userId,
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
      impressions,
      reach,
      collected_at: now,
    });

  if (profileError) throw new Error(`Profile insert error: ${profileError.message}`);

  // 3. Fetch recent media (posts + reels)
  const mediaList = await igGet(`${userId}/media`, {
    fields: "id,media_type,caption,permalink,timestamp",
    limit: "50",
  });

  // 4. Fetch stories
  let storyItems: Array<{ id: string; media_type: string; caption?: string; permalink?: string; timestamp: string }> = [];
  try {
    const stories = await igGet(`${userId}/stories`, {
      fields: "id,media_type,caption,permalink,timestamp",
    });
    storyItems = (stories.data || []).map((s: { id: string; media_type: string; caption?: string; permalink?: string; timestamp: string }) => ({
      ...s,
      media_type: "STORY",
    }));
  } catch {
    // Stories endpoint may fail if no active stories
  }

  const allMedia = [...(mediaList.data || []), ...storyItems];

  if (allMedia.length === 0) {
    return { profileRecords: 1, mediaRecords: 0 };
  }

  // 5. Fetch insights for each media item
  const mediaRows = [];
  for (const media of allMedia) {
    let like_count = 0,
      comments_count = 0,
      reachVal = 0,
      impressionsVal = 0,
      saved = 0,
      shares = 0,
      plays = 0;

    try {
      const mediaType = media.media_type === "REEL" ? "REEL" :
                         media.media_type === "STORY" ? "STORY" :
                         media.media_type === "VIDEO" ? "VIDEO" : "POST";

      let metrics = "impressions,reach";
      if (mediaType === "STORY") {
        metrics = "impressions,reach,replies";
      } else if (mediaType === "REEL") {
        metrics = "impressions,reach,saved,shares,plays,likes,comments";
      } else {
        metrics = "impressions,reach,saved,likes,comments,shares";
      }

      const insightsData = await igGet(`${media.id}/insights`, {
        metric: metrics,
      });

      for (const m of insightsData.data) {
        const val = m.values[0]?.value || 0;
        if (m.name === "impressions") impressionsVal = val;
        if (m.name === "reach") reachVal = val;
        if (m.name === "saved") saved = val;
        if (m.name === "shares") shares = val;
        if (m.name === "plays") plays = val;
        if (m.name === "likes") like_count = val;
        if (m.name === "comments") comments_count = val;
      }
    } catch {
      // Insights may not be available for some media
    }

    const normalizedType =
      media.media_type === "IMAGE" ? "IMAGE" :
      media.media_type === "VIDEO" ? "VIDEO" :
      media.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL" :
      media.media_type === "REEL" ? "REEL" :
      media.media_type === "STORY" ? "STORY" : "IMAGE";

    mediaRows.push({
      media_id: media.id,
      media_type: normalizedType,
      caption: media.caption || null,
      permalink: media.permalink || null,
      like_count,
      comments_count,
      reach: reachVal,
      impressions: impressionsVal,
      saved,
      shares,
      plays,
      published_at: media.timestamp,
      collected_at: now,
    });
  }

  const { error: mediaError } = await supabase
    .from("dash_gestao_instagram_media")
    .insert(mediaRows);

  if (mediaError) throw new Error(`Media insert error: ${mediaError.message}`);

  return { profileRecords: 1, mediaRecords: mediaRows.length };
}
