-- Adiciona coluna de total de inscritos por dia
-- Preenchida durante a coleta via reconstrução retroativa a partir do total atual da API

ALTER TABLE dash_gestao_youtube_channel_daily
  ADD COLUMN IF NOT EXISTS subscriber_count bigint NOT NULL DEFAULT 0;
