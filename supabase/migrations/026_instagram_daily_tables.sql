-- Create Instagram daily metrics tables for structured data collection

-- Profile daily table: tracks account-level metrics per day
CREATE TABLE dash_gestao_instagram_profile_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  date DATE NOT NULL,
  followers_count BIGINT DEFAULT 0,
  follows_count BIGINT DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  reach BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT fk_profile_daily_account FOREIGN KEY (account_id)
    REFERENCES dash_gestao_accounts(id) ON DELETE CASCADE,
  CONSTRAINT uq_profile_daily_account_date UNIQUE (account_id, date)
);

CREATE INDEX idx_profile_daily_account_date
  ON dash_gestao_instagram_profile_daily(account_id, date DESC);

ALTER TABLE dash_gestao_instagram_profile_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_instagram_profile_daily"
  ON dash_gestao_instagram_profile_daily
  FOR SELECT TO authenticated
  USING (true);

-- Media daily table: tracks engagement metrics per media item per day
CREATE TABLE dash_gestao_instagram_media_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  media_id TEXT NOT NULL,
  date DATE NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL', 'REEL')),
  caption TEXT,
  permalink TEXT,

  -- Engagement metrics
  like_count BIGINT DEFAULT 0,
  comments_count BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  views BIGINT DEFAULT 0,
  saved BIGINT DEFAULT 0,

  -- Calculated
  engagement_rate NUMERIC(8, 4) DEFAULT 0,

  -- Technical metadata
  image_url TEXT,
  thumbnail_url TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  carousel_children_count INTEGER,

  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT fk_media_daily_account FOREIGN KEY (account_id)
    REFERENCES dash_gestao_accounts(id) ON DELETE CASCADE,
  CONSTRAINT uq_media_daily_account_media_date UNIQUE (account_id, media_id, date)
);

CREATE INDEX idx_media_daily_account_date
  ON dash_gestao_instagram_media_daily(account_id, date DESC);
CREATE INDEX idx_media_daily_media_id
  ON dash_gestao_instagram_media_daily(media_id);

ALTER TABLE dash_gestao_instagram_media_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_instagram_media_daily"
  ON dash_gestao_instagram_media_daily
  FOR SELECT TO authenticated
  USING (true);
