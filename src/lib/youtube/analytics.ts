// src/lib/youtube/analytics.ts

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function columnarToObjects(
  data: { columnHeaders?: { name: string }[]; rows?: unknown[][] }
): Record<string, unknown>[] {
  if (!data.rows || !data.columnHeaders) return [];
  const keys = data.columnHeaders.map((h) => h.name);
  return data.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    keys.forEach((key, i) => {
      obj[key] = row[i];
    });
    return obj;
  });
}

function chunkDateRange(
  start: string,
  end: string
): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const chunkEnd = new Date(current);
    chunkEnd.setDate(chunkEnd.getDate() + 364);
    const actualEnd = chunkEnd > endDate ? endDate : chunkEnd;
    chunks.push({
      start: current.toISOString().slice(0, 10),
      end: actualEnd.toISOString().slice(0, 10),
    });
    current = new Date(actualEnd);
    current.setDate(current.getDate() + 1);
  }

  return chunks;
}

async function analyticsGet(
  accessToken: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const url = new URL(ANALYTICS_BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Analytics API (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export interface ChannelDailyApiRow {
  date: string;
  views: number;
  estimated_minutes_watched: number;
  average_view_duration: number;
  average_view_percentage: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  shares: number;
}

export async function queryChannelDaily(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
): Promise<ChannelDailyApiRow[]> {
  const chunks = chunkDateRange(startDate, endDate);
  const allRows: ChannelDailyApiRow[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const data = await analyticsGet(accessToken, {
      ids: `channel==${channelId}`,
      startDate: chunk.start,
      endDate: chunk.end,
      metrics:
        "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
        "subscribersGained,subscribersLost,likes,comments,shares",
      dimensions: "day",
      filters: "creatorContentType==VIDEO_ON_DEMAND",
    });

    const rows = columnarToObjects(data);
    for (const r of rows) {
      allRows.push({
        date: r.day as string,
        views: Number(r.views ?? 0),
        estimated_minutes_watched: Number(r.estimatedMinutesWatched ?? 0),
        average_view_duration: Number(r.averageViewDuration ?? 0),
        average_view_percentage: Number(r.averageViewPercentage ?? 0),
        subscribers_gained: Number(r.subscribersGained ?? 0),
        subscribers_lost: Number(r.subscribersLost ?? 0),
        likes: Number(r.likes ?? 0),
        comments: Number(r.comments ?? 0),
        shares: Number(r.shares ?? 0),
      });
    }

    if (i < chunks.length - 1) await sleep(200);
  }

  return allRows;
}
