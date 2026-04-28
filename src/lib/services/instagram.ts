import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Account, InstagramCredentials } from "@/types/accounts";

const IG_API_BASE = "https://graph.facebook.com/v21.0";

async function igGet(
  endpoint: string,
  params: Record<string, string>,
  accessToken: string
) {
  const url = new URL(`${IG_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Instagram API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function collectInstagramDaily(account: Account): Promise<{
  profileRecords: number;
  mediaRecords: number;
}> {
  const { access_token, user_id } = account.credentials as InstagramCredentials;
  const supabase = createSupabaseServiceClient();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // 1. Fetch profile data
  const profile = await igGet(
    user_id,
    { fields: "followers_count,follows_count,media_count" },
    access_token
  );

  // 2. Fetch profile insights (reach) for today
  let reach = 0;
  try {
    const insights = await igGet(
      `${user_id}/insights`,
      {
        metric: "reach",
        period: "day",
        since: String(Math.floor(new Date(today).getTime() / 1000)),
        until: String(Math.floor(new Date(today).getTime() / 1000 + 86400)),
      },
      access_token
    );
    for (const metric of insights.data) {
      const total = metric.values.reduce(
        (sum: number, v: { value: number }) => sum + v.value,
        0
      );
      if (metric.name === "reach") reach = total;
    }
  } catch {
    // Insights may not be available — continue with zeros
  }

  // 3. Insert/upsert profile daily record
  const profileData = {
    account_id: account.id,
    date: today,
    followers_count: profile.followers_count,
    follows_count: profile.follows_count,
    media_count: profile.media_count,
    reach,
    impressions: 0,
  };

  const { error: profileError } = await supabase
    .from("dash_gestao_instagram_profile_daily")
    .upsert(profileData, { onConflict: "account_id,date" });

  if (profileError) throw new Error(`Profile daily upsert error: ${profileError.message}`);

  // Also insert into old table for parallel period
  const { error: profileLegacyError } = await supabase
    .from("dash_gestao_instagram_profile_snapshots")
    .insert({
      account_id: account.id,
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
      impressions: 0,
      reach,
      collected_at: new Date().toISOString(),
    });

  if (profileLegacyError) throw new Error(`Profile snapshot insert error: ${profileLegacyError.message}`);

  // 4. Fetch recent media (last 5)
  const mediaList = await igGet(
    `${user_id}/media`,
    { fields: "id,media_type,caption,permalink,timestamp,media_url,thumbnail_url,width,height,media_duration,carousel_media", limit: "5" },
    access_token
  );

  const allMedia = mediaList.data || [];

  if (allMedia.length === 0) {
    return { profileRecords: 1, mediaRecords: 0 };
  }

  // 5. Fetch insights for each media item
  const mediaRows: any[] = [];
  const mediaLegacyRows: any[] = [];

  for (const media of allMedia) {
    let like_count = 0,
      comments_count = 0,
      reachVal = 0,
      impressionsVal = 0,
      saved = 0,
      shares = 0,
      views = 0;

    try {
      let metrics = "reach";
      if (media.media_type === "STORY") {
        metrics = "reach,replies";
      } else if (media.media_type === "REEL") {
        metrics = "reach,saved,shares,likes,comments,views";
      } else {
        metrics = "reach,saved,likes,comments,shares,views";
      }

      const insightsData = await igGet(
        `${media.id}/insights`,
        { metric: metrics },
        access_token
      );

      for (const m of insightsData.data) {
        const val = m.values[0]?.value || 0;
        if (m.name === "reach") reachVal = val;
        if (m.name === "saved") saved = val;
        if (m.name === "shares") shares = val;
        if (m.name === "views") views = val;
        if (m.name === "likes") like_count = val;
        if (m.name === "comments") comments_count = val;
      }
    } catch {
      // Insights may not be available for some media
    }

    // Calculate engagement rate: ((likes + comments + shares) / reach) * 100
    const engagementRate = reachVal > 0
      ? ((like_count + comments_count + shares) / reachVal) * 100
      : 0;

    const normalizedType =
      media.media_type === "IMAGE" ? "IMAGE" :
      media.media_type === "VIDEO" ? "VIDEO" :
      media.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL" :
      media.media_type === "REEL" ? "REEL" :
      media.media_type === "STORY" ? "STORY" : "IMAGE";

    // New daily record
    mediaRows.push({
      account_id: account.id,
      media_id: media.id,
      date: today,
      media_type: normalizedType,
      caption: media.caption || null,
      permalink: media.permalink || null,
      like_count,
      comments_count,
      shares,
      reach: reachVal,
      views,
      saved,
      engagement_rate: parseFloat(engagementRate.toFixed(4)),
      image_url: media.media_url || null,
      thumbnail_url: media.thumbnail_url || null,
      width: media.width || null,
      height: media.height || null,
      duration_ms: media.media_type === "REEL" ? (media.media_duration * 1000) : null,
      carousel_children_count: media.media_type === "CAROUSEL_ALBUM" ? (media.carousel_media?.length || 0) : null,
      published_at: media.timestamp,
    });

    // Legacy snapshot record (for parallel period)
    mediaLegacyRows.push({
      account_id: account.id,
      media_id: media.id,
      media_type: normalizedType,
      caption: media.caption || null,
      permalink: media.permalink || null,
      like_count,
      comments_count,
      reach: reachVal,
      impressions: views,
      saved,
      shares,
      plays: media.media_type === "REEL" ? views : null,
      published_at: media.timestamp,
      collected_at: new Date().toISOString(),
    });
  }

  // Insert daily records
  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabase
      .from("dash_gestao_instagram_media_daily")
      .upsert(mediaRows, { onConflict: "account_id,media_id,date" });

    if (mediaError) throw new Error(`Media daily upsert error: ${mediaError.message}`);
  }

  // Insert legacy records (parallel period)
  if (mediaLegacyRows.length > 0) {
    const { error: mediaLegacyError } = await supabase
      .from("dash_gestao_instagram_media_snapshots")
      .insert(mediaLegacyRows);

    if (mediaLegacyError) throw new Error(`Media snapshot insert error: ${mediaLegacyError.message}`);
  }

  return { profileRecords: 1, mediaRecords: mediaRows.length };
}

export async function collectInstagramBatch(
  account: Account,
  start_date: string,
  end_date: string
): Promise<{
  profileRecords: number;
  mediaRecords: number;
}> {
  const { access_token, user_id } = account.credentials as InstagramCredentials;
  const supabase = createSupabaseServiceClient();

  const startUnix = Math.floor(new Date(start_date).getTime() / 1000);
  const endUnix = Math.floor(new Date(end_date).getTime() / 1000);

  // Fetch daily insights (reach) for the date range
  const insights = await igGet(
    `${user_id}/insights`,
    {
      metric: "reach",
      period: "day",
      since: String(startUnix),
      until: String(endUnix),
    },
    access_token
  );

  const dailyMap: Record<string, { reach: number }> = {};

  for (const metric of insights.data) {
    for (const value of metric.values) {
      const dateStr = value.end_time.split("T")[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { reach: 0 };
      }
      if (metric.name === "reach") dailyMap[dateStr].reach = value.value;
    }
  }

  // Insert daily profile records
  const profileRows = Object.entries(dailyMap).map(([date, metrics]) => ({
    account_id: account.id,
    date,
    followers_count: 0, // Not available from insights endpoint
    follows_count: 0,
    media_count: 0,
    reach: metrics.reach,
    impressions: 0,
  }));

  if (profileRows.length > 0) {
    const { error: profileError } = await supabase
      .from("dash_gestao_instagram_profile_daily")
      .upsert(profileRows, { onConflict: "account_id,date" });

    if (profileError) {
      throw new Error(`Profile daily batch upsert error: ${profileError.message}`);
    }
  }

  // Also insert into legacy table
  const profileLegacyRows = Object.entries(dailyMap).map(([date, metrics]) => ({
    account_id: account.id,
    followers_count: 0,
    follows_count: 0,
    media_count: 0,
    impressions: 0,
    reach: metrics.reach,
    collected_at: new Date(`${date}T00:00:00Z`).toISOString(),
  }));

  if (profileLegacyRows.length > 0) {
    const { error: profileLegacyError } = await supabase
      .from("dash_gestao_instagram_profile_snapshots")
      .insert(profileLegacyRows);

    if (profileLegacyError) {
      throw new Error(`Profile snapshot batch insert error: ${profileLegacyError.message}`);
    }
  }

  // Fetch current media (last 5 - API doesn't support historical media)
  const mediaList = await igGet(
    `${user_id}/media`,
    { fields: "id,media_type,caption,permalink,timestamp,media_url,thumbnail_url,width,height,media_duration,carousel_media", limit: "5" },
    access_token
  );

  const allMedia = mediaList.data || [];
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  if (allMedia.length === 0) {
    return { profileRecords: profileRows.length, mediaRecords: 0 };
  }

  const mediaRows: any[] = [];
  const mediaLegacyRows: any[] = [];

  for (const media of allMedia) {
    let like_count = 0,
      comments_count = 0,
      reachVal = 0,
      impressionsVal = 0,
      saved = 0,
      shares = 0,
      views = 0;

    try {
      let metrics = "reach";
      if (media.media_type === "STORY") {
        metrics = "reach,replies";
      } else if (media.media_type === "REEL") {
        metrics = "reach,saved,shares,likes,comments,views";
      } else {
        metrics = "reach,saved,likes,comments,shares,views";
      }

      const insightsData = await igGet(
        `${media.id}/insights`,
        { metric: metrics },
        access_token
      );

      for (const m of insightsData.data) {
        const val = m.values[0]?.value || 0;
        if (m.name === "reach") reachVal = val;
        if (m.name === "saved") saved = val;
        if (m.name === "shares") shares = val;
        if (m.name === "views") views = val;
        if (m.name === "likes") like_count = val;
        if (m.name === "comments") comments_count = val;
      }
    } catch {
      // Insights may not be available
    }

    const engagementRate = reachVal > 0
      ? ((like_count + comments_count + shares) / reachVal) * 100
      : 0;

    const normalizedType =
      media.media_type === "IMAGE" ? "IMAGE" :
      media.media_type === "VIDEO" ? "VIDEO" :
      media.media_type === "CAROUSEL_ALBUM" ? "CAROUSEL" :
      media.media_type === "REEL" ? "REEL" :
      media.media_type === "STORY" ? "STORY" : "IMAGE";

    // Daily record (use batch date range as context - will be re-collected for batch dates)
    mediaRows.push({
      account_id: account.id,
      media_id: media.id,
      date: today, // Use today since API doesn't provide historical media
      media_type: normalizedType,
      caption: media.caption || null,
      permalink: media.permalink || null,
      like_count,
      comments_count,
      shares,
      reach: reachVal,
      views,
      saved,
      engagement_rate: parseFloat(engagementRate.toFixed(4)),
      image_url: media.media_url || null,
      thumbnail_url: media.thumbnail_url || null,
      width: media.width || null,
      height: media.height || null,
      duration_ms: media.media_type === "REEL" ? (media.media_duration * 1000) : null,
      carousel_children_count: media.media_type === "CAROUSEL_ALBUM" ? (media.carousel_media?.length || 0) : null,
      published_at: media.timestamp,
    });

    // Legacy snapshot
    mediaLegacyRows.push({
      account_id: account.id,
      media_id: media.id,
      media_type: normalizedType,
      caption: media.caption || null,
      permalink: media.permalink || null,
      like_count,
      comments_count,
      reach: reachVal,
      impressions: views,
      saved,
      shares,
      plays: media.media_type === "REEL" ? views : null,
      published_at: media.timestamp,
      collected_at: now,
    });
  }

  // Insert daily records
  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabase
      .from("dash_gestao_instagram_media_daily")
      .upsert(mediaRows, { onConflict: "account_id,media_id,date" });

    if (mediaError) {
      throw new Error(`Media daily batch upsert error: ${mediaError.message}`);
    }
  }

  // Insert legacy records
  if (mediaLegacyRows.length > 0) {
    const { error: mediaLegacyError } = await supabase
      .from("dash_gestao_instagram_media_snapshots")
      .insert(mediaLegacyRows);

    if (mediaLegacyError) {
      throw new Error(`Media snapshot batch insert error: ${mediaLegacyError.message}`);
    }
  }

  return { profileRecords: profileRows.length, mediaRecords: mediaRows.length };
}
