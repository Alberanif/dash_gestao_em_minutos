CREATE TABLE dash_gestao_meta_ads_campaigns_daily (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    uuid NOT NULL REFERENCES dash_gestao_accounts(id) ON DELETE CASCADE,
  campaign_id   text NOT NULL,
  campaign_name text NOT NULL,
  date          date NOT NULL,
  spend         numeric(12,2) DEFAULT 0,
  impressions   bigint DEFAULT 0,
  reach         bigint DEFAULT 0,
  clicks        bigint DEFAULT 0,
  ctr           numeric(8,4) DEFAULT 0,
  cpm           numeric(10,4) DEFAULT 0,
  conversions   integer DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (account_id, campaign_id, date)
);

ALTER TABLE dash_gestao_meta_ads_campaigns_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_meta_ads_campaigns_daily"
  ON dash_gestao_meta_ads_campaigns_daily
  FOR SELECT TO authenticated USING (true);
