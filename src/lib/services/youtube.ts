// src/lib/services/youtube.ts
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/youtube/auth";
import { queryChannelDaily } from "@/lib/youtube/analytics";
import {
  fetchChannelInfo,
  fetchUploadedVideoIds,
  fetchVideoStats,
} from "@/lib/youtube/data-api";
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
    const historyStart =
      creds.history_start_date ??
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { start: historyStart, end: today };
  }

  // Re-fetch last 3 days to cover data stabilisation window
  const lastDate = new Date(data.date);
  lastDate.setDate(lastDate.getDate() - 3);
  return { start: lastDate.toISOString().slice(0, 10), end: today };
}

export async function collectYouTube(account: Account): Promise<{
  channelRecords: number;
  videoRecords: number;
  analyticsError?: string;
}> {
  const creds = account.credentials as YouTubeCredentials;
  const supabase = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Tentar obter token OAuth; se indisponível, usar API key para Camada 1
  let accessToken: string | null = null;
  let auth: { bearer: string } | { key: string };

  try {
    accessToken = await getValidAccessToken(account);
    auth = { bearer: accessToken };
  } catch {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("OAuth indisponível e YOUTUBE_API_KEY não configurada");
    auth = { key: apiKey };
    console.warn(
      `[youtube/collect] OAuth indisponível para "${account.name}" — usando API key para Data API (Analytics API será pulada)`
    );
  }

  // 2. Verificar info do canal e detectar canais sem vídeos
  const channelInfo = await fetchChannelInfo(creds.channel_id, auth);

  if (channelInfo.videoCount === 0) {
    console.info(
      `[youtube/collect] Canal "${account.name}" (${creds.channel_id}) sem vídeos publicados — coleta ignorada.`
    );
    return { channelRecords: 0, videoRecords: 0 };
  }

  // Usar uploads_playlist_id salvo nas credenciais; fallback para o detectado agora
  const uploadsPlaylistId = creds.uploads_playlist_id ?? channelInfo.uploadsPlaylistId;

  // 3. Listar todos os IDs de vídeos do canal
  const videoIds = await fetchUploadedVideoIds(uploadsPlaylistId, auth);

  // 4. Buscar stats e metadados de todos os vídeos (chunks de 50)
  const videoData = await fetchVideoStats(videoIds, auth);

  // 5. Upsert metadados dos vídeos
  if (videoData.length > 0) {
    const { error: metaError } = await supabase
      .from("dash_gestao_youtube_videos")
      .upsert(
        videoData.map((v) => ({
          account_id: account.id,
          video_id: v.video_id,
          title: v.title,
          published_at: v.published_at,
          thumbnail_url: v.thumbnail_url,
          duration: v.duration,
        })),
        { onConflict: "account_id,video_id" }
      );
    if (metaError) throw new Error(`Video metadata upsert: ${metaError.message}`);
  }

  // 6. Upsert stats de vídeo do dia (um registro por vídeo por dia)
  if (videoData.length > 0) {
    const { error: statsError } = await supabase
      .from("dash_gestao_youtube_video_daily")
      .upsert(
        videoData.map((v) => ({
          account_id: account.id,
          video_id: v.video_id,
          date: today,
          views: v.views,
          estimated_minutes_watched: 0, // indisponível na Data API v3
          average_view_duration: 0,     // indisponível na Data API v3
          average_view_percentage: 0,   // indisponível na Data API v3
          likes: v.likes,
          comments: v.comments,
        })),
        { onConflict: "account_id,video_id,date" }
      );
    if (statsError) throw new Error(`Video daily upsert: ${statsError.message}`);
  }

  // 7. Camada 2 (best-effort): séries temporais diárias via Analytics API
  //    Só executa se temos token OAuth (Analytics API não aceita API key)

  if (!accessToken) {
    return {
      channelRecords: 0,
      videoRecords: videoData.length,
      analyticsError: `OAuth não disponível para "${account.name}" — reconecte a conta via Configurações.`,
    };
  }

  const syncRange = await detectSyncRange(account);
  let channelRecords = 0;
  let analyticsError: string | undefined;

  try {
    const channelRows = await queryChannelDaily(
      accessToken,
      creds.channel_id,
      syncRange.start,
      syncRange.end
    );

    if (channelRows.length > 0) {
      const { error: channelError } = await supabase
        .from("dash_gestao_youtube_channel_daily")
        .upsert(
          channelRows.map((r) => ({ account_id: account.id, ...r })),
          { onConflict: "account_id,date" }
        );
      if (channelError) throw new Error(`Channel daily upsert: ${channelError.message}`);
      channelRecords = channelRows.length;
    } else {
      analyticsError = `Analytics API retornou 0 linhas para "${account.name}" no período ${syncRange.start}→${syncRange.end}. Verifique se o token tem permissão yt-analytics.readonly no canal ${creds.channel_id}.`;
    }
  } catch (analyticsErr) {
    analyticsError = analyticsErr instanceof Error ? analyticsErr.message : String(analyticsErr);
  }

  return {
    channelRecords,
    videoRecords: videoData.length,
    analyticsError,
  };
}
