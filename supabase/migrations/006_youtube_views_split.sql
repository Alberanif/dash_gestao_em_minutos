-- Adiciona colunas para separar views de vídeos regulares e Shorts
-- views_videos: visualizações de vídeos regulares (VIDEO_ON_DEMAND)
-- views_shorts: visualizações de YouTube Shorts

ALTER TABLE dash_gestao_youtube_channel_daily
  ADD COLUMN IF NOT EXISTS views_videos BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_shorts BIGINT NOT NULL DEFAULT 0;
