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
  views: number;                    // total = views_videos + views_shorts
  views_videos: number;             // VIDEO_ON_DEMAND only
  views_shorts: number;             // SHORT only
  estimated_minutes_watched: number; // VIDEO_ON_DEMAND only; Shorts watch-time not collected
  average_view_duration: number;     // VIDEO_ON_DEMAND only
  average_view_percentage: number;   // VIDEO_ON_DEMAND only
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  ctr: number;
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

    // Chamada 1: tenta coletar métricas de vídeos regulares com filtro VIDEO_ON_DEMAND.
    // Alguns canais não têm segmentação por tipo de conteúdo habilitada na Analytics API
    // e recebem 400 para esse filtro. Nesse caso, faz fallback sem filtro (views totais).
    let viewVideoData: Record<string, unknown>;
    let contentTypeFilterSupported = true;
    try {
      viewVideoData = await analyticsGet(accessToken, {
        ids: `channel==${channelId}`,
        startDate: chunk.start,
        endDate: chunk.end,
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
          "likes,comments,shares,impressions,impressionClickThroughRate",
        dimensions: "day",
        filters: "creatorContentType==VIDEO_ON_DEMAND",
      });
    } catch {
      contentTypeFilterSupported = false;
      viewVideoData = await analyticsGet(accessToken, {
        ids: `channel==${channelId}`,
        startDate: chunk.start,
        endDate: chunk.end,
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage," +
          "likes,comments,shares,impressions,impressionClickThroughRate",
        dimensions: "day",
      });
    }

    await sleep(100);

    // Chamada 2: views de Shorts — ignorada se o canal não suporta filtro de tipo de conteúdo.
    // Se VIDEO_ON_DEMAND falhou com 400, SHORT provavelmente também falharia.
    let viewShortsData: Record<string, unknown> = {};
    if (contentTypeFilterSupported) {
      try {
        viewShortsData = await analyticsGet(accessToken, {
          ids: `channel==${channelId}`,
          startDate: chunk.start,
          endDate: chunk.end,
          metrics: "views",
          dimensions: "day",
          filters: "creatorContentType==SHORT",
        });
      } catch {
        // Canal não suporta filtro SHORT — views_shorts ficará 0 para todos os dias
      }
    }

    await sleep(100);

    // Chamada 3: métricas de inscritos (sem filtro — são métricas de conta)
    const subsData = await analyticsGet(accessToken, {
      ids: `channel==${channelId}`,
      startDate: chunk.start,
      endDate: chunk.end,
      metrics: "subscribersGained,subscribersLost",
      dimensions: "day",
    });

    const viewVideoRows = columnarToObjects(viewVideoData);
    const viewShortsRows = columnarToObjects(viewShortsData);
    const subsRows = columnarToObjects(subsData);

    // Indexa cada dataset por data para merge O(1)
    const videoByDate = new Map<string, Record<string, unknown>>(
      viewVideoRows.map((r) => [r.day as string, r])
    );
    const shortsByDate = new Map<string, Record<string, unknown>>(
      viewShortsRows.map((r) => [r.day as string, r])
    );
    const subsByDate = new Map<string, Record<string, unknown>>(
      subsRows.map((r) => [r.day as string, r])
    );

    // Âncora: união de datas das 3 chamadas.
    // Garante que nenhum dia é perdido, independente do tipo de conteúdo do canal
    // (canal só de Shorts, só de vídeos, ou misto).
    // Dias com subscriber_gained/lost mas views=0 são válidos (ex: recomendação de
    // conteúdo antigo gera inscritos sem views no período filtrado).
    const allDates = new Set<string>([
      ...subsRows.map((r) => r.day as string),
      ...viewVideoRows.map((r) => r.day as string),
      ...viewShortsRows.map((r) => r.day as string),
    ]);

    for (const date of [...allDates].sort()) {
      const video = videoByDate.get(date);
      const shorts = shortsByDate.get(date);
      const sub = subsByDate.get(date);

      const viewsVideos = Number(video?.views ?? 0);
      const viewsShorts = Number(shorts?.views ?? 0);

      allRows.push({
        date,
        views: viewsVideos + viewsShorts,
        views_videos: viewsVideos,
        views_shorts: viewsShorts,
        estimated_minutes_watched: Number(video?.estimatedMinutesWatched ?? 0),
        average_view_duration: Number(video?.averageViewDuration ?? 0),
        average_view_percentage: Number(video?.averageViewPercentage ?? 0),
        subscribers_gained: Number(sub?.subscribersGained ?? 0),
        subscribers_lost: Number(sub?.subscribersLost ?? 0),
        likes: Number(video?.likes ?? 0),
        comments: Number(video?.comments ?? 0),
        shares: Number(video?.shares ?? 0),
        impressions: Number(video?.impressions ?? 0),
        ctr: Number(video?.impressionClickThroughRate ?? 0),
      });
    }

    if (i < chunks.length - 1) await sleep(200);
  }

  return allRows;
}
