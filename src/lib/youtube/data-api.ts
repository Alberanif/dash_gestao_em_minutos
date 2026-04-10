// src/lib/youtube/data-api.ts
// Funções de acesso à YouTube Data API v3.
// Autenticação: Bearer token (OAuth) para rotas de coleta,
//               API key para validações no backend sem token do usuário.

const DATA_API_BASE = "https://www.googleapis.com/youtube/v3";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Auth = { bearer: string } | { key: string };

async function dataApiGet(
  path: string,
  params: Record<string, string>,
  auth: Auth
): Promise<Record<string, unknown>> {
  const url = new URL(`${DATA_API_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = {};
  if ("bearer" in auth) {
    headers["Authorization"] = `Bearer ${auth.bearer}`;
  } else {
    url.searchParams.set("key", auth.key);
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    throw new Error(`Data API (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// ── Info do canal ───────────────────────────────────────────────────────────

export interface ChannelInfo {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export async function fetchChannelInfo(
  channelId: string,
  auth: Auth
): Promise<ChannelInfo> {
  const data = await dataApiGet(
    "channels",
    { part: "statistics,contentDetails", id: channelId },
    auth
  );

  const item = (data.items as {
    statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }[])?.[0];

  if (!item) throw new Error(`Canal não encontrado: ${channelId}`);

  return {
    subscriberCount: parseInt(item.statistics.subscriberCount ?? "0"),
    viewCount: parseInt(item.statistics.viewCount ?? "0"),
    videoCount: parseInt(item.statistics.videoCount ?? "0"),
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}

// ── IDs de vídeos do canal ──────────────────────────────────────────────────

export async function fetchUploadedVideoIds(
  uploadsPlaylistId: string,
  auth: Auth
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await dataApiGet("playlistItems", params, auth);
    const items = data.items as { contentDetails: { videoId: string } }[] | undefined;

    for (const item of items ?? []) {
      ids.push(item.contentDetails.videoId);
    }

    pageToken = (data.nextPageToken as string) ?? undefined;
    if (pageToken) await sleep(100);
  } while (pageToken);

  return [...new Set(ids)];
}

// ── Stats por vídeo ─────────────────────────────────────────────────────────

export interface VideoDataRow {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string;
  duration: string;
  views: number;
  likes: number;
  comments: number;
}

export async function fetchVideoStats(
  videoIds: string[],
  auth: Auth
): Promise<VideoDataRow[]> {
  if (videoIds.length === 0) return [];

  const results: VideoDataRow[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const data = await dataApiGet(
      "videos",
      { part: "statistics,snippet,contentDetails", id: chunk.join(",") },
      auth
    );

    const items = data.items as {
      id: string;
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
      snippet: {
        title: string;
        publishedAt: string;
        thumbnails?: { medium?: { url: string } };
      };
      contentDetails: { duration: string };
    }[] | undefined;

    for (const item of items ?? []) {
      results.push({
        video_id: item.id,
        title: item.snippet.title,
        published_at: item.snippet.publishedAt,
        thumbnail_url: item.snippet.thumbnails?.medium?.url ?? "",
        duration: item.contentDetails.duration,
        views: parseInt(item.statistics.viewCount ?? "0"),
        likes: parseInt(item.statistics.likeCount ?? "0"),
        comments: parseInt(item.statistics.commentCount ?? "0"),
      });
    }

    if (i + 50 < videoIds.length) await sleep(100);
  }

  return results;
}
